"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { Search, Heart, MessageSquare, MapPin, Send, Loader2, User, ImageIcon, X, Trash2 } from "lucide-react";
import Link from "next/link";

// Types based on Prisma
type Post = {
  id: string;
  type: string;
  content: string | null;
  mediaUrl: string | null;
  createdAt: string;
  user: { id: string; name: string | null; image: string | null };
  run: { distance: number; avgPace: number; durationSec: number } | null;
  _count: { likes: number; comments?: number };
  isLiked?: boolean; // We'll manage this locally for now
};

type CommentType = {
  id: string;
  content: string;
  createdAt: string;
  user: { id: string; name: string | null; image: string | null };
};

export default function FeedTab() {
  const { data: session } = useSession();
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Post Creation State
  const [newPostContent, setNewPostContent] = useState("");
  const [isPosting, setIsPosting] = useState(false);
  const [attachedImageFile, setAttachedImageFile] = useState<File | null>(null);
  const [attachedImagePreview, setAttachedImagePreview] = useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  // Comments State
  const [expandedCommentsPostId, setExpandedCommentsPostId] = useState<string | null>(null);
  const [commentsData, setCommentsData] = useState<Record<string, CommentType[]>>({});
  const [newCommentContent, setNewCommentContent] = useState<Record<string, string>>({});
  const [isPostingComment, setIsPostingComment] = useState(false);
  
  // Current User State (for Avatar)
  const [currentUser, setCurrentUser] = useState<{ id: string; name: string | null; image: string | null } | null>(null);

  useEffect(() => {
    if (session?.user) {
      fetch(`/api/users?userId=${(session.user as any).id}`)
        .then(res => res.json())
        .then(data => {
          if (data.user) setCurrentUser(data.user);
        })
        .catch(console.error);
    }
  }, [session]);

  useEffect(() => {
    fetchFeed();
  }, []);

  const fetchFeed = async () => {
    try {
      const res = await fetch('/api/feed', { cache: 'no-store' });
      const data = await res.json();
      if (data.posts) {
        setPosts(data.posts);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleImageAttach = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setAttachedImageFile(file);
      setAttachedImagePreview(URL.createObjectURL(file));
    }
  };

  const removeAttachment = () => {
    setAttachedImageFile(null);
    setAttachedImagePreview(null);
  };

  const handlePost = async () => {
    if (!session?.user || (!newPostContent.trim() && !attachedImageFile)) return;
    
    setIsPosting(true);
    try {
      let uploadedMediaUrl = null;
      if (attachedImageFile) {
        setIsUploadingImage(true);
        uploadedMediaUrl = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(attachedImageFile);
        });
        setIsUploadingImage(false);
      }

      const res = await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: (session.user as any).id,
          content: newPostContent,
          mediaUrl: uploadedMediaUrl,
        })
      });
      const data = await res.json();
      if (data.success && data.post) {
        setPosts([data.post, ...posts]);
        setNewPostContent("");
        removeAttachment();
      }
    } catch (e) {
      console.error(e);
      setIsUploadingImage(false);
    } finally {
      setIsPosting(false);
    }
  };

  const toggleLike = (id: string) => {
    // Optimistic UI for likes
    setPosts(posts.map(p => {
      if (p.id === id) {
        const liked = !p.isLiked;
        return { 
          ...p, 
          isLiked: liked,
          _count: { ...p._count, likes: p._count.likes + (liked ? 1 : -1) }
        };
      }
      return p;
    }));
    // In real app, make POST /api/likes here
  };

  const toggleComments = async (postId: string) => {
    if (expandedCommentsPostId === postId) {
      setExpandedCommentsPostId(null);
      return;
    }
    setExpandedCommentsPostId(postId);
    
    if (!commentsData[postId]) {
      try {
        const res = await fetch(`/api/posts/${postId}/comments`);
        const data = await res.json();
        if (data.success) {
          setCommentsData(prev => ({ ...prev, [postId]: data.comments }));
        }
      } catch (e) {
        console.error(e);
      }
    }
  };

  const handlePostComment = async (postId: string) => {
    const content = newCommentContent[postId];
    if (!session?.user || !content?.trim()) return;

    setIsPostingComment(true);
    try {
      const res = await fetch(`/api/posts/${postId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: (session.user as any).id,
          content: content.trim()
        })
      });
      const data = await res.json();
      if (data.success && data.comment) {
        setCommentsData(prev => ({
          ...prev,
          [postId]: [...(prev[postId] || []), data.comment]
        }));
        setNewCommentContent(prev => ({ ...prev, [postId]: "" }));
        
        // Update comment count optimistically
        setPosts(posts.map(p => {
          if (p.id === postId) {
            return {
              ...p,
              _count: { ...p._count, comments: (p._count.comments || 0) + 1 }
            };
          }
          return p;
        }));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsPostingComment(false);
    }
  };

  const handleDeletePost = async (postId: string) => {
    if (!confirm("Вы уверены, что хотите удалить этот пост?")) return;
    try {
      const res = await fetch(`/api/posts/${postId}`, { method: 'DELETE' });
      if (res.ok) {
        setPosts(posts.filter(p => p.id !== postId));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteComment = async (postId: string, commentId: string) => {
    if (!confirm("Вы уверены, что хотите удалить этот комментарий?")) return;
    try {
      const res = await fetch(`/api/comments/${commentId}`, { method: 'DELETE' });
      if (res.ok) {
        setCommentsData(prev => ({
          ...prev,
          [postId]: prev[postId]?.filter((c: any) => c.id !== commentId)
        }));
        setPosts(posts.map(p => {
          if (p.id === postId) {
            return {
              ...p,
              _count: { ...p._count, comments: Math.max(0, (p._count?.comments || 1) - 1) }
            };
          }
          return p;
        }));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const diff = new Date().getTime() - new Date(dateString).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 60) return `${minutes || 1}м`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}ч`;
    return `${Math.floor(hours / 24)}д`;
  };

  const formatPace = (pace: number) => {
    if (!pace || !isFinite(pace)) return "--:--";
    const min = Math.floor(pace);
    const sec = Math.floor((pace - min) * 60);
    return `${min}:${sec.toString().padStart(2, '0')}`;
  };

  const formatTime = (sec: number) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col min-h-[100dvh] text-foreground pb-24 relative z-10">
      {/* Header Sticky */}
      <div className="sticky top-0 z-20 bg-background/80 backdrop-blur-xl border-b border-border px-4 py-4 flex justify-between items-center">
        <h1 className="text-2xl font-black tracking-tight uppercase">Беговая Лента</h1>
      </div>

      {/* Composer (Tweet Box) */}
      <div className="px-4 py-4 border-b border-border bg-card/30">
        <div className="flex gap-3">
          {currentUser?.image ? (
            <img src={currentUser.image} className="w-10 h-10 rounded-full object-cover border border-border shrink-0" />
          ) : (
            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center shrink-0 border border-border">
              <User size={20} className="text-foreground" />
            </div>
          )}
          
          <div className="flex-1 flex flex-col">
            <div className="flex items-start gap-2">
              <textarea
                placeholder="Как прошла тренировка? Что нового?"
                value={newPostContent}
                onChange={(e) => setNewPostContent(e.target.value)}
                className="w-full bg-transparent resize-none outline-none text-lg placeholder:text-muted/70 min-h-[60px]"
              />
              <label className="w-10 h-10 shrink-0 rounded-full flex items-center justify-center text-muted hover:bg-muted/50 transition-colors cursor-pointer mt-0.5">
                <input type="file" accept="image/*" className="hidden" onChange={handleImageAttach} />
                <ImageIcon size={20} />
              </label>
            </div>

            {attachedImagePreview && (
              <div className="relative mt-2 w-max">
                <img src={attachedImagePreview} className="h-32 rounded-xl object-cover border border-border" alt="preview" />
                <button onClick={removeAttachment} className="absolute -top-2 -right-2 bg-background border border-border text-foreground rounded-full p-1 hover:text-red-500 transition-colors">
                  <X size={14} />
                </button>
              </div>
            )}
            
            <div className="flex justify-end mt-2">
              <button 
                onClick={handlePost}
                disabled={(!newPostContent.trim() && !attachedImageFile) || isPosting || isUploadingImage || !session}
                className="bg-primary text-black font-bold px-5 py-2 rounded-full text-sm hover:bg-[#b3e600] transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {isPosting || isUploadingImage ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                Запостить
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Feed List */}
      <div className="flex flex-col">
        {isLoading ? (
          <div className="flex justify-center p-12">
            <Loader2 className="animate-spin text-primary" size={32} />
          </div>
        ) : posts.length === 0 ? (
          <div className="p-8 text-center text-muted">
            Пока нет постов. Станьте первым!
          </div>
        ) : (
          posts.map((post) => (
            <div key={post.id} className="p-4 border-b border-border bg-background hover:bg-card/20 transition-colors cursor-pointer">
              <div className="flex gap-3">
                {/* Avatar */}
                <Link href={`/users/${(post.user as any)?.id}`} onClick={(e) => e.stopPropagation()} className="shrink-0">
                  {post.user?.image ? (
                    <img src={post.user.image} alt="avatar" className="w-10 h-10 rounded-full border border-border shrink-0 object-cover" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center shrink-0 border border-border">
                      <User size={20} className="text-foreground" />
                    </div>
                  )}
                </Link>
                
                <div className="flex-1 min-w-0">
                  {/* Header */}
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <Link href={`/users/${(post.user as any)?.id}`} onClick={(e) => e.stopPropagation()} className="font-bold truncate hover:underline">
                        {post.user?.name || "Аноним"}
                      </Link>
                      <span className="text-muted text-sm shrink-0">· {formatTimeAgo(post.createdAt)}</span>
                    </div>
                    {session?.user && (session.user as any).id === post.user?.id && (
                      <button onClick={(e) => { e.stopPropagation(); handleDeletePost(post.id); }} className="text-muted hover:text-red-500 transition-colors p-1">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>

                  {/* Content (Text) */}
                  {post.content && (
                    <p className="text-foreground text-sm leading-relaxed whitespace-pre-wrap mb-3">
                      {post.content}
                    </p>
                  )}

                  {/* Run Widget (If attached) */}
                  {post.type === "RUN" && post.run && (
                    <div className="rounded-[16px] border border-border bg-card overflow-hidden mb-3">
                      <div className="h-20 bg-muted/30 relative">
                        {/* Fake map background for runs */}
                        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(#A0A0A0 1px, transparent 1px)', backgroundSize: '10px 10px' }}></div>
                        <svg className="absolute inset-0 w-full h-full z-10" viewBox="0 0 100 100" preserveAspectRatio="none">
                          <path d="M 10,80 Q 40,60 50,40 T 90,20" fill="none" stroke="#CCFF00" strokeWidth="2" strokeLinecap="round" opacity="0.6" />
                        </svg>
                      </div>
                      
                      <div className="p-3 grid grid-cols-3 gap-2 divide-x divide-border">
                        <div className="text-center">
                          <p className="text-[10px] text-muted uppercase font-bold">Дистанция</p>
                          <p className="font-black text-lg">{post.run.distance.toFixed(2)}<span className="text-[10px] text-muted font-normal ml-0.5">км</span></p>
                        </div>
                        <div className="text-center">
                          <p className="text-[10px] text-muted uppercase font-bold">Темп</p>
                          <p className="font-black text-lg">{formatPace(post.run.avgPace)}<span className="text-[10px] text-muted font-normal ml-0.5">/км</span></p>
                        </div>
                        <div className="text-center">
                          <p className="text-[10px] text-muted uppercase font-bold">Время</p>
                          <p className="font-black text-lg">{formatTime(post.run.durationSec)}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Media (If attached) */}
                  {post.mediaUrl && (
                    <div className="mb-3 rounded-xl overflow-hidden border border-border bg-card">
                      <img src={post.mediaUrl} alt="Post media" className="w-full h-auto object-cover max-h-[400px]" />
                    </div>
                  )}

                  {/* Action Bar */}
                  <div className="flex items-center justify-between text-muted mt-2 max-w-[200px]">
                    <button 
                      onClick={(e) => { e.stopPropagation(); toggleLike(post.id); }}
                      className={`flex items-center gap-1.5 transition-colors group ${post.isLiked ? 'text-red-500' : 'hover:text-red-500'}`}
                    >
                      <div className="p-1.5 rounded-full group-hover:bg-red-500/10 transition-colors">
                        <Heart size={16} className={post.isLiked ? "fill-red-500 text-red-500" : ""} />
                      </div>
                      <span className="text-xs font-medium">{post._count?.likes || 0}</span>
                    </button>
                    
                    <button 
                      onClick={(e) => { e.stopPropagation(); toggleComments(post.id); }}
                      className={`flex items-center gap-1.5 transition-colors group ${expandedCommentsPostId === post.id ? 'text-blue-500' : 'hover:text-blue-500'}`}
                    >
                      <div className="p-1.5 rounded-full group-hover:bg-blue-500/10 transition-colors">
                        <MessageSquare size={16} className={expandedCommentsPostId === post.id ? "fill-blue-500 text-blue-500" : ""} />
                      </div>
                      <span className="text-xs font-medium">{post._count?.comments || 0}</span>
                    </button>
                  </div>

                  {/* Comments Section */}
                  {expandedCommentsPostId === post.id && (
                    <div className="mt-4 pt-4 border-t border-border animate-in fade-in slide-in-from-top-2 duration-300">
                      <div className="flex flex-col gap-4 mb-4">
                        {!commentsData[post.id] ? (
                          <div className="flex justify-center p-4"><Loader2 className="animate-spin text-muted" size={20} /></div>
                        ) : commentsData[post.id].length === 0 ? (
                          <div className="text-sm text-muted text-center py-2">Пока нет комментариев</div>
                        ) : (
                          commentsData[post.id].map(comment => (
                            <div key={comment.id} className="flex gap-2">
                              <Link href={`/users/${comment.user.id}`} onClick={(e) => e.stopPropagation()} className="shrink-0 mt-1">
                                {comment.user.image ? (
                                  <img src={comment.user.image} className="w-8 h-8 rounded-full border border-border object-cover" />
                                ) : (
                                  <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center border border-border"><User size={14} /></div>
                                )}
                              </Link>
                              <div className="flex-1 bg-card border border-border rounded-xl px-3 py-2">
                                <div className="flex justify-between items-baseline mb-1">
                                  <div className="flex items-baseline gap-2">
                                    <Link href={`/users/${comment.user.id}`} onClick={(e) => e.stopPropagation()} className="font-bold text-sm hover:underline">{comment.user.name || "Аноним"}</Link>
                                    <span className="text-[10px] text-muted">{formatTimeAgo(comment.createdAt)}</span>
                                  </div>
                                  {session?.user && (session.user as any).id === comment.user?.id && (
                                    <button onClick={(e) => { e.stopPropagation(); handleDeleteComment(post.id, comment.id); }} className="text-muted hover:text-red-500 transition-colors">
                                      <Trash2 size={12} />
                                    </button>
                                  )}
                                </div>
                                <p className="text-sm text-foreground/90">{comment.content}</p>
                              </div>
                            </div>
                          ))
                        )}
                      </div>

                      {/* Comment Input */}
                      <div className="flex gap-2 items-center">
                        <input
                          type="text"
                          placeholder="Написать комментарий..."
                          value={newCommentContent[post.id] || ""}
                          onChange={(e) => setNewCommentContent(prev => ({ ...prev, [post.id]: e.target.value }))}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handlePostComment(post.id);
                            }
                          }}
                          className="flex-1 bg-card border border-border rounded-full px-4 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                        />
                        <button
                          onClick={() => handlePostComment(post.id)}
                          disabled={!newCommentContent[post.id]?.trim() || isPostingComment}
                          className="w-9 h-9 rounded-full bg-primary text-black flex items-center justify-center disabled:opacity-50 shrink-0"
                        >
                          {isPostingComment ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
