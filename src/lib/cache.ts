export const globalCache: {
  feedPosts: any | null;
  userData: any | null;
  clubs: any | null;
  events: any | null;
  leaderboard: Record<string, any[]>;
  isInitialLoadComplete: boolean;
} = {
  feedPosts: null,
  userData: null,
  clubs: null,
  events: null,
  leaderboard: {},
  isInitialLoadComplete: false,
};
