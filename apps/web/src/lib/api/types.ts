export type Profile = {
  id: string;
  email: string;
  displayName: string;
  createdAt: string;
  updatedAt: string;
};

export type Workspace = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  _count: { members: number };
};

export type Member = {
  id: string;
  role: 'OWNER' | 'ADMIN' | 'EDITOR' | 'VIEWER';
  joinedAt: string;
  user: { id: string; displayName: string; email: string };
};

export type Invitation = {
  id: string;
  email: string;
  role: 'ADMIN' | 'EDITOR' | 'VIEWER';
  expiresAt: string;
  createdAt: string;
};

export type BoardColumn = {
  id: string;
  name: string;
  position: number;
  createdAt: string;
  updatedAt: string;
};

export type Board = {
  id: string;
  projectId: string;
  name: string;
  version: number;
  columns: BoardColumn[];
  createdAt: string;
  updatedAt: string;
};

export type Project = {
  id: string;
  workspaceId: string;
  name: string;
  description: string | null;
  status: 'ACTIVE' | 'ARCHIVED';
  boards: Board[];
  createdAt: string;
  updatedAt: string;
};

export type Task = {
  id: string;
  boardId: string;
  columnId: string;
  title: string;
  description: string | null;
  rank: string;
  priority: 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  dueAt: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  assignees: Array<{
    user: { id: string; displayName: string; email: string };
  }>;
  labels: Array<{ label: { id: string; name: string; color: string } }>;
};

export type TaskPage = { items: Task[]; nextCursor: string | null };
export type TaskComment = {
  id: string;
  taskId: string;
  content: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  author: { id: string; displayName: string };
  mentions: Array<{ user: { id: string; displayName: string; email: string } }>;
};
export type CommentPage = { items: TaskComment[]; nextCursor: string | null };
export type TaskLabel = {
  id: string;
  name: string;
  color: string;
  createdAt: string;
};
