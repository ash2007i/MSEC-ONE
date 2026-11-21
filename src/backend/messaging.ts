import { requireAuthenticatedUser, supabase } from './supabase';

export interface Conversation {
  id: string;
  conversation_type: string;
  title: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface ChatMemberProfile {
  user_id: string;
  full_name: string;
  avatar_url: string | null;
  headline: string | null;
  is_verified: boolean;
}

export interface ChatMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  message_text: string | null;
  attachment_path: string | null;
  created_at: string;
  edited_at: string | null;
  deleted_at: string | null;
}

export interface InboxConversation {
  conversation: Conversation;
  members: ChatMemberProfile[];
  lastMessage: ChatMessage | null;
  unreadCount: number;
}

export async function getInboxConversations(): Promise<InboxConversation[]> {
  const user = await requireAuthenticatedUser();

  const { data: myMemberships, error: memError } = await supabase
    .from('conversation_members')
    .select('conversation_id')
    .eq('user_id', user.id);

  if (memError) throw memError;

  const conversationIds = Array.from(
    new Set((myMemberships ?? []).map((m) => m.conversation_id as string))
  );
  if (conversationIds.length === 0) return [];

  const [convsRes, allMembersRes, messagesRes, readsRes] = await Promise.all([
    supabase
      .from('conversations')
      .select('*')
      .in('id', conversationIds)
      .order('updated_at', { ascending: false }),
    supabase
      .from('conversation_members')
      .select('conversation_id, user_id')
      .in('conversation_id', conversationIds),
    supabase
      .from('messages')
      .select('*')
      .in('conversation_id', conversationIds)
      .is('deleted_at', null)
      .order('created_at', { ascending: false }),
    supabase
      .from('message_reads')
      .select('message_id')
      .eq('user_id', user.id),
  ]);

  if (convsRes.error) throw convsRes.error;
  if (allMembersRes.error) throw allMembersRes.error;
  if (messagesRes.error) throw messagesRes.error;
  if (readsRes.error) throw readsRes.error;

  const memberUserIds = Array.from(
    new Set((allMembersRes.data ?? []).map((m) => m.user_id as string))
  );

  const { data: memberProfiles, error: profError } = await supabase
    .from('profiles')
    .select('user_id, full_name, avatar_url, headline, is_verified')
    .in('user_id', memberUserIds);

  if (profError) throw profError;

  const profileMap = new Map(
    ((memberProfiles ?? []) as ChatMemberProfile[]).map((p) => [p.user_id, p])
  );

  const membersByConv = new Map<string, ChatMemberProfile[]>();
  for (const row of allMembersRes.data ?? []) {
    const cid = row.conversation_id as string;
    const prof = profileMap.get(row.user_id as string);
    if (!prof) continue;
    const list = membersByConv.get(cid) ?? [];
    list.push(prof);
    membersByConv.set(cid, list);
  }

  const readIds = new Set((readsRes.data ?? []).map((r) => r.message_id as string));
  const lastMessageByConv = new Map<string, ChatMessage>();
  const unreadByConv = new Map<string, number>();

  for (const msg of (messagesRes.data ?? []) as ChatMessage[]) {
    if (!lastMessageByConv.has(msg.conversation_id)) {
      lastMessageByConv.set(msg.conversation_id, msg);
    }
    if (msg.sender_id !== user.id && !readIds.has(msg.id)) {
      unreadByConv.set(
        msg.conversation_id,
        (unreadByConv.get(msg.conversation_id) ?? 0) + 1
      );
    }
  }

  const inbox = ((convsRes.data ?? []) as Conversation[]).map((conversation) => ({
    conversation,
    members: membersByConv.get(conversation.id) ?? [],
    lastMessage: lastMessageByConv.get(conversation.id) ?? null,
    unreadCount: unreadByConv.get(conversation.id) ?? 0,
  }));

  inbox.sort((a, b) => {
    const timeA = a.lastMessage?.created_at ?? a.conversation.updated_at;
    const timeB = b.lastMessage?.created_at ?? b.conversation.updated_at;
    return timeB.localeCompare(timeA);
  });

  return inbox;
}

export async function getOrCreateDirectConversation(
  otherUserId: string
): Promise<string> {
  const user = await requireAuthenticatedUser();
  if (otherUserId === user.id) {
    throw new Error('Cannot start a direct conversation with yourself.');
  }

  // Check if a direct conversation between both users already exists
  const existingInbox = await getInboxConversations();
  const match = existingInbox.find(
    (item) =>
      item.conversation.conversation_type === 'direct' &&
      item.members.length === 2 &&
      item.members.some((m) => m.user_id === otherUserId)
  );
  if (match) return match.conversation.id;

  // Generate ID client-side so we don't hit SELECT RLS before members are added
  const conversationId = crypto.randomUUID();

  const { error: convError } = await supabase.from('conversations').insert({
    id: conversationId,
    conversation_type: 'direct',
    title: null,
    created_by: user.id,
  });
  if (convError) throw convError;

  // ignoreDuplicates handles both cases (whether or not a DB trigger auto-adds creator)
  const { error: membersError } = await supabase
    .from('conversation_members')
    .upsert(
      [
        { conversation_id: conversationId, user_id: user.id },
        { conversation_id: conversationId, user_id: otherUserId },
      ],
      { onConflict: 'conversation_id,user_id', ignoreDuplicates: true }
    );
  if (membersError) throw membersError;

  return conversationId;
}

export async function createGroupConversation(
  title: string,
  memberUserIds: string[]
): Promise<string> {
  const user = await requireAuthenticatedUser();
  const conversationId = crypto.randomUUID();
  const uniqueMembers = Array.from(new Set([user.id, ...memberUserIds]));

  const { error: convError } = await supabase.from('conversations').insert({
    id: conversationId,
    conversation_type: 'group',
    title: title.trim(),
    created_by: user.id,
  });
  if (convError) throw convError;

  const { error: membersError } = await supabase
    .from('conversation_members')
    .upsert(
      uniqueMembers.map((uid) => ({
        conversation_id: conversationId,
        user_id: uid,
      })),
      { onConflict: 'conversation_id,user_id', ignoreDuplicates: true }
    );
  if (membersError) throw membersError;

  return conversationId;
}

export async function getConversationMessages(
  conversationId: string,
  limit = 50
): Promise<ChatMessage[]> {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error) throw error;
  return (data ?? []) as ChatMessage[];
}

export async function sendMessage(
  conversationId: string,
  messageText: string,
  attachmentPath?: string | null
): Promise<ChatMessage> {
  const user = await requireAuthenticatedUser();
  const trimmed = messageText.trim();

  if (!trimmed && !attachmentPath) {
    throw new Error('Message must include text or an attachment.');
  }

  const { data, error } = await supabase
    .from('messages')
    .insert({
      conversation_id: conversationId,
      sender_id: user.id,
      message_text: trimmed || null,
      attachment_path: attachmentPath ?? null,
    })
    .select()
    .single();

  if (error) throw error;
  return data as ChatMessage;
}

export async function deleteMessage(messageId: string): Promise<void> {
  const user = await requireAuthenticatedUser();

  const { error } = await supabase
    .from('messages')
    .delete()
    .eq('id', messageId)
    .eq('sender_id', user.id);

  if (error) throw error;
}

export async function markMessagesAsRead(messageIds: string[]): Promise<void> {
  if (messageIds.length === 0) return;
  const user = await requireAuthenticatedUser();
  const now = new Date().toISOString();

  const { error } = await supabase.from('message_reads').upsert(
    messageIds.map((message_id) => ({
      message_id,
      user_id: user.id,
      read_at: now,
    })),
    { onConflict: 'message_id,user_id', ignoreDuplicates: true }
  );

  if (error) throw error;
}

export function subscribeToConversation(
  conversationId: string,
  onMessage: (message: ChatMessage) => void
): () => void {
  const channel = supabase
    .channel(`conversation:${conversationId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversationId}`,
      },
      (payload) => {
        onMessage(payload.new as ChatMessage);
      }
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}