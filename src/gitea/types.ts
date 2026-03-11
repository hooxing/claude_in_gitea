export type GiteaUser = {
  id: number;
  login: string;
  full_name?: string;
  email?: string;
  avatar_url?: string;
  is_admin?: boolean;
};

export type GiteaComment = {
  id: number;
  body: string;
  user: GiteaUser;
  created_at: string;
  updated_at?: string;
  html_url?: string;
};

export type GiteaPullReviewComment = {
  id: number;
  body: string;
  user: GiteaUser;
  path: string;
  position: number;
  created_at: string;
  updated_at?: string;
  html_url?: string;
};

export type GiteaCommitUser = {
  name: string;
  email: string;
  date?: string;
};

export type GiteaCommit = {
  sha: string;
  commit: {
    message: string;
    author: GiteaCommitUser;
    committer?: GiteaCommitUser;
  };
};

export type GiteaChangedFile = {
  filename: string;
  additions: number;
  deletions: number;
  status: string;
  changes?: number;
  previous_filename?: string;
  contents_url?: string;
};

export type GiteaPullReview = {
  id: number;
  body?: string;
  state: string;
  submitted_at?: string;
  commit_id?: string;
  user: GiteaUser;
};

export type GiteaPullRequest = {
  id: number;
  number: number;
  title: string;
  body?: string;
  user: GiteaUser;
  state: string;
  merged?: boolean;
  created_at: string;
  updated_at?: string;
  html_url?: string;
  base: {
    ref: string;
    sha?: string;
    repo?: {
      full_name?: string;
    };
  };
  head: {
    ref: string;
    sha?: string;
    repo?: {
      full_name?: string;
    };
  };
  labels?: Array<{ name: string }>;
};

export type GiteaIssue = {
  id: number;
  number: number;
  title: string;
  body?: string;
  state: string;
  created_at: string;
  updated_at?: string;
  html_url?: string;
  user: GiteaUser;
  labels?: Array<{ name: string }>;
  pull_request?: {
    merged?: boolean;
    merged_at?: string;
  };
};

export type GiteaBranch = {
  name: string;
  commit: {
    id: string;
    message?: string;
  };
};

export type GiteaRepo = {
  id: number;
  name: string;
  full_name: string;
  default_branch: string;
  html_url?: string;
};
