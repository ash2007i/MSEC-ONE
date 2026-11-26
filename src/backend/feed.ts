import { requireAuthenticatedUser, supabase } from './supabase';

export interface PostAuthor {
  user_id: string;
  full_name: string;
  avatar_url: string | null;
  headline: string | null;
  company: string | null;
  is_verified: boolean;
}

export interface FeedPost {
  id: string;
  author_id: string;
  content: string;
  image_url: string | null;
  category: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  author: PostAuthor | null;
  like_count: number;
  comment_count: number;
  liked_by_me: boolean;
}

export interface PostComment {
  id: string;
  post_id: string;
  author_id: string;
  content: string;
  created_at: string;
  author: PostAuthor | null;
}

export interface CreatePostInput {
  content: string;
  imageUrl?: string | null;
  category?: string | null;
  status?: 'published' | 'draft';
}

export async function getFeedPosts(options?: {
  category?: string;
  limit?: number;
  offset?: number;
}): Promise<FeedPost[]> {
  const user = await requireAuthenticatedUser();
  const limit = options?.limit ?? 20;
  const offset = options?.offset ?? 0;

  let query = supabase
    .from('posts')
    .select('*')
    .eq('status', 'published')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (options?.category && options.category !== 'All') {
    query = query.eq('category', options.category);
  }

  const { data: rawPosts, error } = await query;
  if (error) throw error;

  const posts = (rawPosts ?? []) as Array<
    Omit<FeedPost, 'author' | 'like_count' | 'comment_count' | 'liked_by_me'>
  >;
  if (posts.length === 0) return [];

  const postIds = posts.map((p) => p.id);
  const authorIds = Array.from(new Set(posts.map((p) => p.author_id)));

  const [authorsRes, likesRes, commentsRes] = await Promise.all([
    supabase
      .from('profiles')
      .select('user_id, full_name, avatar_url, headline, company, is_verified')
      .in('user_id', authorIds),
    supabase.from('post_likes').select('post_id, user_id').in('post_id', postIds),
    supabase.from('post_comments').select('post_id').in('post_id', postIds),
  ]);

  if (authorsRes.error) throw authorsRes.error;
  if (likesRes.error) throw likesRes.error;
  if (commentsRes.error) throw commentsRes.error;

  const authorMap = new Map(
    ((authorsRes.data ?? []) as PostAuthor[]).map((a) => [a.user_id, a])
  );

  const likeCountMap = new Map<string, number>();
  const myLikes = new Set<string>();
  for (const like of likesRes.data ?? []) {
    const pid = like.post_id as string;
    likeCountMap.set(pid, (likeCountMap.get(pid) ?? 0) + 1);
    if (like.user_id === user.id) myLikes.add(pid);
  }

  const commentCountMap = new Map<string, number>();
  for (const comment of commentsRes.data ?? []) {
    const pid = comment.post_id as string;
    commentCountMap.set(pid, (commentCountMap.get(pid) ?? 0) + 1);
  }

  return posts.map((post) => ({
    ...post,
    author: authorMap.get(post.author_id) ?? null,
    like_count: likeCountMap.get(post.id) ?? 0,
    comment_count: commentCountMap.get(post.id) ?? 0,
    liked_by_me: myLikes.has(post.id),
  }));
}

export async function createPost(input: CreatePostInput) {
  const user = await requireAuthenticatedUser();
  const content = input.content.trim();

  if (!content) {
    throw new Error('Post content cannot be empty.');
  }

  const { data, error } = await supabase
    .from('posts')
    .insert({
      author_id: user.id,
      content,
      image_url: input.imageUrl ?? null,
      category: input.category ?? 'General',
      status: input.status ?? 'published',
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updatePost(
  postId: string,
  updates: { content?: string; image_url?: string | null; category?: string | null; status?: string }
) {
  const user = await requireAuthenticatedUser();

  const { data, error } = await supabase
    .from('posts')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', postId)
    .eq('author_id', user.id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deletePost(postId: string): Promise<void> {
  const user = await requireAuthenticatedUser();

  const { error } = await supabase
    .from('posts')
    .delete()
    .eq('id', postId)
    .eq('author_id', user.id);

  if (error) throw error;
}

export async function togglePostLike(
  postId: string
): Promise<{ liked: boolean }> {
  const user = await requireAuthenticatedUser();

  const { data: existing, error: checkError } = await supabase
    .from('post_likes')
    .select('post_id')
    .eq('post_id', postId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (checkError) throw checkError;

  if (existing) {
    const { error } = await supabase
      .from('post_likes')
      .delete()
      .eq('post_id', postId)
      .eq('user_id', user.id);
    if (error) throw error;
    return { liked: false };
  }

  const { error } = await supabase.from('post_likes').insert({
    post_id: postId,
    user_id: user.id,
  });
  if (error) throw error;
  return { liked: true };
}

export async function getPostComments(postId: string): Promise<PostComment[]> {
  const { data: rawComments, error } = await supabase
    .from('post_comments')
    .select('*')
    .eq('post_id', postId)
    .order('created_at', { ascending: true });

  if (error) throw error;

  const comments = (rawComments ?? []) as Array<Omit<PostComment, 'author'>>;
  if (comments.length === 0) return [];

  const authorIds = Array.from(new Set(comments.map((c) => c.author_id)));
  const { data: authors, error: authorError } = await supabase
    .from('profiles')
    .select('user_id, full_name, avatar_url, headline, company, is_verified')
    .in('user_id', authorIds);

  if (authorError) throw authorError;

  const authorMap = new Map(
    ((authors ?? []) as PostAuthor[]).map((a) => [a.user_id, a])
  );

  return comments.map((comment) => ({
    ...comment,
    author: authorMap.get(comment.author_id) ?? null,
  }));
}

export async function addPostComment(
  postId: string,
  content: string
): Promise<PostComment> {
  const user = await requireAuthenticatedUser();
  const trimmed = content.trim();
  if (!trimmed) throw new Error('Comment cannot be empty.');

  const { data, error } = await supabase
    .from('post_comments')
    .insert({
      post_id: postId,
      author_id: user.id,
      content: trimmed,
    })
    .select()
    .single();

  if (error) throw error;

  const { data: author } = await supabase
    .from('profiles')
    .select('user_id, full_name, avatar_url, headline, company, is_verified')
    .eq('user_id', user.id)
    .maybeSingle();

  return {
    ...(data as Omit<PostComment, 'author'>),
    author: (author as PostAuthor | null) ?? null,
  };
}

export async function deletePostComment(commentId: string): Promise<void> {
  const user = await requireAuthenticatedUser();

  const { error } = await supabase
    .from('post_comments')
    .delete()
    .eq('id', commentId)
    .eq('author_id', user.id);

  if (error) throw error;
}
