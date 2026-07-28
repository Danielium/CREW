"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { Search, Heart, MessageSquare, MapPin, Send, Loader2, User, ImageIcon, X, Trash2 } from "lucide-react";
import Link from "next/link";
import { triggerHaptic } from "@/lib/haptics";

// Types based on Prisma
type Post = {
  id: string;
  type: string;
  content: string | null;
  mediaUrl: string | null;
  createdAt: string;
  user: { id: string; name: string | null; image: string | null; telegramUsername?: string | null };
  run: { distance: number; avgPace: number; durationSec: number } | null;
  _count: { likes: number; comments?: number };
  isLiked?: boolean; // We'll manage this locally for now
};

type CommentType = {
  id: string;
  content: string;
  createdAt: string;
  user: { id: string; name: string | null; image: string | null; telegramUsername?: string | null };
  mediaUrl?: string | null;
};

import { uploadMedia } from "@/lib/uploadImage";
import { globalCache } from "@/lib/cache";
import { MediaCarousel, parseMedia, serializeMedia, type MediaItem } from "@/components/MediaCarousel";

const MEDIA_ACCEPT = "image/*,video/mp4,video/webm,video/quicktime";
const MAX_ATTACHMENTS = 10;

type Draft = { file: File; previewUrl: string; type: "image" | "video" };

export default function FeedTab() {
  const { data: session, update: updateSession } = useSession();
  const [posts, setPosts] = useState<Post[]>(globalCache.feedPosts || []);
  const [isLoading, setIsLoading] = useState(!globalCache.feedPosts);
  
  // Post Creation State
  const [newPostContent, setNewPostContent] = useState("");
  const [isPosting, setIsPosting] = useState(false);
  const [attachedDrafts, setAttachedDrafts] = useState<Draft[]>([]);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  // Comments State
  const [expandedCommentsPostId, setExpandedCommentsPostId] = useState<string | null>(null);
  const [commentsData, setCommentsData] = useState<Record<string, CommentType[]>>({});
  const [newCommentContent, setNewCommentContent] = useState<Record<string, string>>({});
  const [isPostingComment, setIsPostingComment] = useState(false);
  const [commentDrafts, setCommentDrafts] = useState<Record<string, Draft[]>>({});
  
  // Current User State (for Avatar)
  const [currentUser, setCurrentUser] = useState<{ id: string; name: string | null; image: string | null } | null>(globalCache.userData || null);

  useEffect(() => {
    if (session?.user) {
      fetch(`/api/users/${(session.user as any).id}`)
        .then(res => res.json())
        .then(data => {
          if (data.user) {
            setCurrentUser(data.user);
            globalCache.userData = data.user;
            
            // Sync session if image is missing/outdated (fixes 2s avatar loading for existing sessions)
            // CRITICAL: NEVER pass base64 to NextAuth session or it will exceed Vercel header limits!
            if ((session.user as any).image !== data.user.image && data.user.image && !data.user.image.startsWith('data:image')) {
              updateSession({ image: data.user.image, name: data.user.name });
            }
          }
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
        globalCache.feedPosts = data.posts;
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (posts.length > 0) {
      globalCache.feedPosts = posts;
    }
  }, [posts]);

  const filesToDrafts = (fileList: FileList, existing: number): Draft[] =>
    Array.from(fileList)
      .slice(0, Math.max(0, MAX_ATTACHMENTS - existing))
      .map((file) => ({
        file,
        previewUrl: URL.createObjectURL(file),
        type: file.type.startsWith("video/") ? "video" : "image",
      }));

  const handleImageAttach = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;
    const filesArray = Array.from(e.target.files);
    setAttachedDrafts((prev) => [...prev, ...filesToDrafts(filesArray as unknown as FileList, prev.length)]);
    e.target.value = "";
  };

  const removeAttachment = (index?: number) => {
    setAttachedDrafts((prev) => {
      if (index === undefined) {
        prev.forEach((d) => URL.revokeObjectURL(d.previewUrl));
        return [];
      }
      const draft = prev[index];
      if (draft) URL.revokeObjectURL(draft.previewUrl);
      return prev.filter((_, i) => i !== index);
    });
  };

  const uploadDrafts = async (drafts: Draft[]): Promise<MediaItem[] | null> => {
    const uploaded: MediaItem[] = [];
    for (const draft of drafts) {
      const result = await uploadMedia(draft.file);
      if (!result) return null;
      uploaded.push(result);
    }
    return uploaded;
  };

  const handlePost = async () => {
    if (!session?.user || (!newPostContent.trim() && attachedDrafts.length === 0)) return;

    setIsPosting(true);
    try {
      let uploadedMediaUrl: string | null = null;
      if (attachedDrafts.length > 0) {
        setIsUploadingImage(true);
        const uploaded = await uploadDrafts(attachedDrafts);
        setIsUploadingImage(false);

        if (!uploaded) {
          alert("Не удалось загрузить вложение");
          setIsPosting(false);
          return;
        }
        uploadedMediaUrl = serializeMedia(uploaded);
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

  const toggleLike = async (id: string) => {
    triggerHaptic('light');
    // Optimistic UI for likes
    setPosts(prev => 
      prev.map(p => {
        if (p.id === id) {
          const liked = !p.isLiked;
          return {
            ...p,
            isLiked: liked,
            _count: { ...p._count, likes: p._count.likes + (liked ? 1 : -1) }
          };
        }
        return p;
      })
    );

    try {
      await fetch('/api/likes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId: id })
      });
    } catch (e) {
      console.error("Failed to toggle like", e);
    }
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
    const content = newCommentContent[postId] || "";
    const drafts = commentDrafts[postId] || [];
    if (!session?.user || (!content.trim() && drafts.length === 0)) return;

    setIsPostingComment(true);
    try {
      let uploadedMediaUrl: string | null = null;
      if (drafts.length > 0) {
        const uploaded = await uploadDrafts(drafts);

        if (!uploaded) {
          alert("Не удалось загрузить вложение");
          setIsPostingComment(false);
          return;
        }
        uploadedMediaUrl = serializeMedia(uploaded);
      }

      const res = await fetch(`/api/posts/${postId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: (session.user as any).id,
          content: content.trim(),
          mediaUrl: uploadedMediaUrl
        })
      });
      const data = await res.json();
      if (data.success && data.comment) {
        setCommentsData(prev => ({
          ...prev,
          [postId]: [...(prev[postId] || []), data.comment]
        }));
        setNewCommentContent(prev => ({ ...prev, [postId]: "" }));
        setCommentDrafts(prev => {
          (prev[postId] || []).forEach(d => URL.revokeObjectURL(d.previewUrl));
          return { ...prev, [postId]: [] };
        });
        
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
    if (diff < 60000) return `только что`;
    const minutes = Math.floor(diff / 60000);
    if (minutes < 60) return `${minutes}м`;
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
      <div className="sticky top-0 z-20 bg-background/80 backdrop-blur-xl border-b border-border px-4 pb-4 pt-safe flex justify-between items-center">
        <h1 className="text-2xl font-black tracking-tight uppercase">ЛЕНТА</h1>
      </div>

      {/* Composer */}
      <div className="bg-card/40 backdrop-blur-md border border-white/5 rounded-[22px] p-4 mx-4 mt-4 flex gap-3">
        {(currentUser?.image || (session?.user as any)?.image) ? (
          <img src={currentUser?.image || (session?.user as any)?.image} className="w-10 h-10 rounded-full object-cover shrink-0" />
        ) : (
          <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center shrink-0">
            <User size={20} className="text-foreground" />
          </div>
        )}

        <div className="flex-1 flex flex-col min-w-0">
          <textarea
            placeholder="Как прошла тренировка?"
            value={newPostContent}
            onChange={(e) => setNewPostContent(e.target.value)}
            className="w-full bg-transparent resize-none outline-none text-[17px] placeholder:text-muted/60 min-h-[40px] pt-1.5"
            rows={1}
          />

          {attachedDrafts.length > 0 && (
            <div className="flex gap-2 mt-2 overflow-x-auto no-scrollbar">
              {attachedDrafts.map((draft, index) => (
                <div key={draft.previewUrl} className="relative shrink-0">
                  {draft.type === "video" ? (
                    <video src={draft.previewUrl} className="h-28 w-auto rounded-xl border border-white/10 bg-black/40" muted playsInline />
                  ) : (
                    <img src={draft.previewUrl} className="h-28 w-auto rounded-xl object-cover border border-white/10" alt="preview" />
                  )}
                  <button
                    onClick={() => removeAttachment(index)}
                    className="absolute -top-2 -right-2 bg-background border border-white/10 text-foreground rounded-full p-1 hover:text-red-500 transition-colors shadow-lg"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/5">
            <label className="w-9 h-9 shrink-0 rounded-full flex items-center justify-center text-primary hover:bg-primary/10 transition-colors cursor-pointer -ml-2">
              <input type="file" accept={MEDIA_ACCEPT} multiple className="hidden" onChange={handleImageAttach} />
              <ImageIcon size={20} />
            </label>
            <button
              onClick={handlePost}
              disabled={(!newPostContent.trim() && attachedDrafts.length === 0) || isPosting || isUploadingImage || !session}
              className="bg-primary text-black font-bold px-5 py-2 rounded-full text-sm hover:bg-[#b3e600] transition-colors disabled:opacity-50 flex items-center justify-center min-w-[90px]"
            >
              {isPosting || isUploadingImage ? <Loader2 size={16} className="animate-spin" /> : "Опубликовать"}
            </button>
          </div>
        </div>
      </div>

      {/* Feed List */}
      <div className="flex flex-col gap-3 px-4 pt-3 pb-4">
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
            <div key={post.id} className="p-4 bg-card/40 backdrop-blur-md border border-white/5 hover:border-white/10 rounded-[22px] transition-colors cursor-pointer">
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

                  {/* Media (If attached) */}
                  {post.mediaUrl && (
                    <div className="mb-3">
                      <MediaCarousel items={parseMedia(post.mediaUrl)} />
                    </div>
                  )}

                  {/* Action Bar */}
                  <div className="flex items-center gap-2 text-muted mt-3">
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleLike(post.id); }}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full transition-colors ${post.isLiked ? 'bg-primary/10 text-primary' : 'bg-white/[0.03] hover:bg-primary/10 hover:text-primary'}`}
                    >
                      <Heart size={16} className={post.isLiked ? "fill-primary text-primary" : ""} />
                      <span className="text-xs font-medium">{post._count?.likes || 0}</span>
                    </button>

                    <button
                      onClick={(e) => { e.stopPropagation(); toggleComments(post.id); }}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full transition-colors ${expandedCommentsPostId === post.id ? 'bg-white/[0.06] text-foreground' : 'bg-white/[0.03] hover:bg-white/[0.06] hover:text-foreground'}`}
                    >
                      <MessageSquare size={16} />
                      <span className="text-xs font-medium">{post._count?.comments || 0}</span>
                    </button>
                  </div>

                </div>
              </div>

              {/* Comments — full card width, deliberately outside the post's
                  avatar-indented column so replies aren't squeezed into ~200px */}
              {expandedCommentsPostId === post.id && (
                <div className="mt-4 pt-4 border-t border-white/5 animate-in fade-in slide-in-from-top-2 duration-300">
                  {!commentsData[post.id] ? (
                    <div className="flex justify-center py-4"><Loader2 className="animate-spin text-muted" size={20} /></div>
                  ) : commentsData[post.id].length === 0 ? (
                    <p className="text-[15px] text-muted text-center py-2">Пока нет комментариев</p>
                  ) : (
                    <div className="flex flex-col gap-5">
                      {commentsData[post.id].map(comment => (
                        <div key={comment.id} className="flex gap-3">
                          <Link href={`/users/${comment.user.id}`} onClick={(e) => e.stopPropagation()} className="shrink-0">
                            {comment.user.image ? (
                              <img src={comment.user.image} className="w-9 h-9 rounded-full object-cover" />
                            ) : (
                              <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center"><User size={17} /></div>
                            )}
                          </Link>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-baseline justify-between gap-2">
                              <div className="flex items-baseline gap-1.5 min-w-0">
                                <Link href={`/users/${comment.user.id}`} onClick={(e) => e.stopPropagation()} className="font-bold text-[15px] text-foreground truncate hover:underline">
                                  {comment.user.name || "Аноним"}
                                </Link>
                                <span className="text-[13px] text-muted shrink-0">{formatTimeAgo(comment.createdAt)}</span>
                              </div>
                              {session?.user && (session.user as any).id === comment.user?.id && (
                                <button onClick={(e) => { e.stopPropagation(); handleDeleteComment(post.id, comment.id); }} className="text-muted hover:text-red-500 transition-colors shrink-0 -mr-1 p-1">
                                  <Trash2 size={14} />
                                </button>
                              )}
                            </div>
                            <p className="text-[15px] text-foreground whitespace-pre-wrap break-words leading-[1.45] mt-0.5">{comment.content}</p>
                            {comment.mediaUrl && (
                              <div className="mt-2.5 max-w-[260px]">
                                <MediaCarousel items={parseMedia(comment.mediaUrl)} />
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Reply composer — Threads sizing: small avatar, one tall pill */}
                  <div className="flex flex-col gap-2 mt-5">
                    {(commentDrafts[post.id]?.length || 0) > 0 && (
                      <div className="flex gap-2 ml-10 overflow-x-auto no-scrollbar">
                        {commentDrafts[post.id].map((draft, index) => (
                          <div key={draft.previewUrl} className="relative shrink-0">
                            {draft.type === "video" ? (
                              <video src={draft.previewUrl} className="h-20 w-auto rounded-xl border border-white/10 bg-black/40" muted playsInline />
                            ) : (
                              <img src={draft.previewUrl} alt="Preview" className="h-20 w-auto rounded-xl object-cover border border-white/10" />
                            )}
                            <button
                              onClick={() => setCommentDrafts(prev => {
                                const list = prev[post.id] || [];
                                URL.revokeObjectURL(list[index]?.previewUrl);
                                return { ...prev, [post.id]: list.filter((_, i) => i !== index) };
                              })}
                              className="absolute -top-2 -right-2 bg-background border border-white/10 rounded-full p-1 hover:text-red-500 transition-colors"
                            >
                              <X size={12} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="flex gap-2 items-center">
                      {(currentUser?.image || (session?.user as any)?.image) ? (
                        <img src={currentUser?.image || (session?.user as any)?.image} className="w-9 h-9 rounded-full object-cover shrink-0" />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center shrink-0">
                          <User size={17} className="text-foreground" />
                        </div>
                      )}

                      <div className="flex-1 min-w-0 flex items-center gap-1 bg-white/[0.06] rounded-full pl-4 pr-1.5 py-2.5 border border-white/[0.06] focus-within:border-white/15 transition-colors">
                        <input
                          type="text"
                          placeholder={`Ответьте ${post.user?.name || "автору"}`}
                          value={newCommentContent[post.id] || ""}
                          onChange={(e) => setNewCommentContent(prev => ({ ...prev, [post.id]: e.target.value }))}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handlePostComment(post.id);
                            }
                          }}
                          className="flex-1 min-w-0 bg-transparent text-[15px] outline-none placeholder:text-muted/60"
                        />
                        <label className="w-8 h-8 shrink-0 rounded-full flex items-center justify-center text-muted hover:text-foreground hover:bg-white/5 transition-colors cursor-pointer">
                          <input
                            type="file"
                            className="hidden"
                            accept={MEDIA_ACCEPT}
                            multiple
                            onChange={(e) => {
                              if (!e.target.files?.length) return;
                              const filesArray = Array.from(e.target.files);
                              setCommentDrafts(prev => {
                                const list = prev[post.id] || [];
                                return { ...prev, [post.id]: [...list, ...filesToDrafts(filesArray as unknown as FileList, list.length)] };
                              });
                              e.target.value = "";
                            }}
                          />
                          <ImageIcon size={17} />
                        </label>
                      </div>

                      <button
                        onClick={() => handlePostComment(post.id)}
                        disabled={(!newCommentContent[post.id]?.trim() && (commentDrafts[post.id]?.length || 0) === 0) || isPostingComment}
                        className="w-9 h-9 rounded-full bg-primary text-black flex items-center justify-center disabled:opacity-30 shrink-0 transition-opacity"
                      >
                        {isPostingComment ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
