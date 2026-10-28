export type StudentProfile = {
  full_name: string;
  university_name: string;
  major: string;
  year_of_study: number;
  bio: string;
  subjects: string[];
  learning_goals: string[];
  availability_days: number[];
  preferred_hours: "morning" | "afternoon" | "evening";
  study_format: "online" | "offline" | "hybrid";
  group_size: number;
  language: string;
  show_in_discovery: boolean;
};

export type DashboardData = {
  profile: StudentProfile;
  profile_completion: number;
  recommended_students: Array<{
    id: string;
    full_name: string;
    major: string;
    compatibility: number;
    shared_subjects: string[];
  }>;
  upcoming_sessions: Array<{
    id: string;
    subject: string;
    topic: string;
    starts_at: string;
    study_format: StudentProfile["study_format"];
  }>;
  study_groups: Array<{
    id: string;
    name: string;
    subject: string;
    visibility: "public" | "private";
    member_count: number;
  }>;
  recent_conversations: Array<{
    id: string;
    title: string;
    last_message: string | null;
    unread_count: number;
  }>;
  unread_notifications: number;
};

export type MatchBreakdown = {
  subjects: number;
  availability: number;
  learning_goals: number;
  study_format: number;
  language: number;
};

export type DiscoverableStudent = {
  id: string;
  full_name: string;
  university_name: string;
  major: string;
  year_of_study: number;
  bio: string;
  subjects: string[];
  study_format: StudentProfile["study_format"];
  preferred_hours: StudentProfile["preferred_hours"];
  availability_days: number[];
  compatibility: number;
  shared_subjects: string[];
  explanation: string[];
  breakdown: MatchBreakdown;
  connection_status: "pending" | "accepted" | "declined" | null;
  connection_direction: "incoming" | "outgoing" | null;
};

export type DiscoveryPage = {
  items: DiscoverableStudent[];
  page: number;
  page_size: number;
  total: number;
  has_more: boolean;
};

export type Connection = {
  id: string;
  student_id: string;
  full_name: string;
  university_name: string;
  major: string;
  status: "pending" | "accepted" | "declined";
  direction: "incoming" | "outgoing";
  created_at: string;
};

export type StudyGroup = {
  id: string;
  owner_id: string;
  current_user_id: string;
  owner_name: string;
  name: string;
  description: string;
  subject: string;
  visibility: "public" | "private";
  max_members: number;
  member_count: number;
  created_at: string;
  is_member: boolean;
  join_status: "pending" | "approved" | "declined" | null;
  members: GroupMember[];
  join_requests: GroupJoinRequest[];
};

export type GroupMember = {
  student_id: string;
  full_name: string;
  major: string;
  role: "owner" | "member";
  joined_at: string;
};

export type GroupJoinRequest = {
  id: string;
  student_id: string;
  full_name: string;
  major: string;
  status: "pending" | "approved" | "declined";
  created_at: string;
};

export type Conversation = {
  id: string;
  kind: "direct" | "group";
  group_id: string | null;
  connection_id: string | null;
  communication_status: "pending" | "accepted" | "declined" | null;
  request_direction: "incoming" | "outgoing" | null;
  intro_messages_remaining: number | null;
  title: string;
  other_members: string[];
  last_message: string | null;
  last_message_at: string | null;
  unread_count: number;
};

export type ChatMessage = {
  id: string;
  conversation_id: string;
  author_id: string;
  author_name: string;
  body: string;
  created_at: string;
  communication_status?: "pending" | "accepted" | "declined" | null;
  intro_messages_remaining?: number | null;
};

export type Notification = {
  id: string;
  kind: string;
  title: string;
  body: string;
  entity_type: string | null;
  entity_id: string | null;
  read_at: string | null;
  created_at: string;
};

export type SessionParticipant = {
  student_id: string;
  full_name: string;
  status: "invited" | "accepted" | "declined";
};

export type StudySession = {
  id: string;
  owner_id: string;
  current_user_id: string;
  owner_name: string;
  subject: string;
  topic: string;
  starts_at: string;
  duration_minutes: number;
  study_format: "online" | "offline" | "hybrid";
  meeting_details: string;
  max_participants: number;
  status: "scheduled" | "cancelled" | "completed";
  summary: string;
  next_steps: string;
  participants: SessionParticipant[];
};

export type GroupTask = {
  id: string;
  group_id: string;
  created_by: string;
  assigned_to: string | null;
  title: string;
  description: string;
  status: "todo" | "in_progress" | "done";
  due_at: string | null;
  created_at: string;
  updated_at: string;
  creator_name?: string;
  assignee_name?: string | null;
};

export type GroupMaterial = {
  id: string;
  group_id: string;
  created_by: string;
  title: string;
  description: string;
  source_url: string | null;
  file_name: string | null;
  has_file?: boolean;
  created_at: string;
  creator_name?: string;
};

export type GroupFocusSession = {
  id: string;
  group_id: string;
  started_by: string;
  started_by_name?: string;
  focus_minutes: number;
  break_minutes: number;
  status: "running" | "completed" | "cancelled";
  started_at: string;
  ends_at: string;
};

export type StudyGoal = {
  id: string;
  subject: string;
  target_sessions: number;
  target_date: string | null;
  completed_this_week?: number;
  topics: StudyGoalTopic[];
  created_at?: string;
  updated_at?: string;
};

export type StudyGoalTopic = {
  id: string;
  goal_id: string;
  topic: string;
  completed: boolean;
  completed_at: string | null;
  created_at: string;
};

export type BlockedStudent = {
  student_id: string;
  full_name: string;
  major: string;
  created_at: string;
};
