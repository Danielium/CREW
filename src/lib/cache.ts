export const globalCache: {
  feedPosts: any | null;
  userData: any | null;
  clubs: any | null;
  events: any | null;
  mapProposals: any[] | null;
  leaderboard: Record<string, any[]>;
  isInitialLoadComplete: boolean;
} = {
  feedPosts: null,
  userData: null,
  clubs: null,
  events: null,
  mapProposals: null,
  leaderboard: {},
  isInitialLoadComplete: false,
};
