/**
 * Hand-written to match supabase/migrations/0001_init.sql. Regenerate with
 * `supabase gen types typescript` once a live project exists, and diff
 * against this file rather than replacing it — it also documents the enums
 * the rest of the app imports.
 */

export type FormType = 'I-485' | 'I-765' | 'I-130' | 'N-400' | 'I-131' | 'I-751';

export type CaseState = 'active' | 'decided' | 'archived';

export type CaseEventKind =
  | 'filed'
  | 'biometrics_scheduled'
  | 'biometrics'
  | 'interview_scheduled'
  | 'interview'
  | 'rfe'
  | 'transferred'
  | 'decision'
  | 'card_mailed'
  | 'other';

export type CaseEventSource = 'manual' | 'poll' | 'uscis_history';

export type PendingDetailKind =
  | 'interview_date'
  | 'biometrics_date'
  | 'notice_mailed'
  | 'rfe_deadline'
  | 'office_reresolve';

export type ReminderKind = 'rfe_response' | 'interview' | 'biometrics' | 'inquiry_eligibility' | 'ead_expiry';

export type AnalyticsEventName =
  | 'case_added'
  | 'notifications_enabled'
  | 'detail_prompt_answered'
  | 'share_card_exported';

// These are `type` aliases rather than `interface` declarations on purpose:
// supabase-js's generic constraints check each Row against
// `Record<string, unknown>`, and — a genuine TypeScript quirk — a plain
// object-literal type alias satisfies that structural check while a
// same-shaped `interface` does not (interfaces support declaration merging,
// so TS won't treat them as closed for that comparison). Using `interface`
// here silently collapses every query result to `never`.

export type UserRow = {
  id: string;
  email: string | null;
  phone: string | null;
  push_token: string | null;
  timezone: string;
  created_at: string;
};

export type CaseRow = {
  id: string;
  user_id: string;
  receipt_number: string;
  form_type: FormType;
  office_code: string | null;
  office_label: string | null;
  filed_on: string;
  nickname: string | null;
  state: CaseState;
  last_polled_at: string | null;
  created_at: string;
};

export type CaseEventRow = {
  id: string;
  case_id: string;
  kind: CaseEventKind;
  label: string | null;
  occurred_on: string;
  occurred_at_time: string | null;
  source: CaseEventSource;
  created_at: string;
};

export type StatusSnapshotRow = {
  id: string;
  case_id: string;
  status_title: string;
  status_text_hash: string;
  checked_at: string;
};

export type PendingDetailRow = {
  id: string;
  case_id: string;
  kind: PendingDetailKind;
  asked_at: string;
  answered_at: string | null;
  dismissed_at: string | null;
};

export type ProcessingTimeRow = {
  form_type: FormType;
  office_code: string;
  low_days: number;
  high_days: number;
  updated_at: string;
};

export type ReminderRow = {
  id: string;
  case_id: string;
  kind: ReminderKind;
  due_on: string;
  fired_at: string | null;
  created_at: string;
};

export type AnalyticsEventRow = {
  id: number;
  user_id: string;
  event_name: AnalyticsEventName;
  created_at: string;
};

export interface Database {
  public: {
    Tables: {
      users: {
        Row: UserRow;
        Insert: Partial<UserRow> & Pick<UserRow, 'id'>;
        Update: Partial<UserRow>;
        Relationships: [];
      };
      cases: {
        Row: CaseRow;
        Insert: Partial<CaseRow> &
          Pick<CaseRow, 'user_id' | 'receipt_number' | 'form_type' | 'filed_on'>;
        Update: Partial<CaseRow>;
        Relationships: [
          {
            foreignKeyName: 'cases_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      case_events: {
        Row: CaseEventRow;
        Insert: Partial<CaseEventRow> &
          Pick<CaseEventRow, 'case_id' | 'kind' | 'occurred_on' | 'source'>;
        Update: Partial<CaseEventRow>;
        Relationships: [
          {
            foreignKeyName: 'case_events_case_id_fkey';
            columns: ['case_id'];
            isOneToOne: false;
            referencedRelation: 'cases';
            referencedColumns: ['id'];
          },
        ];
      };
      status_snapshots: {
        Row: StatusSnapshotRow;
        Insert: Partial<StatusSnapshotRow> &
          Pick<StatusSnapshotRow, 'case_id' | 'status_title' | 'status_text_hash'>;
        Update: Partial<StatusSnapshotRow>;
        Relationships: [
          {
            foreignKeyName: 'status_snapshots_case_id_fkey';
            columns: ['case_id'];
            isOneToOne: false;
            referencedRelation: 'cases';
            referencedColumns: ['id'];
          },
        ];
      };
      pending_details: {
        Row: PendingDetailRow;
        Insert: Partial<PendingDetailRow> & Pick<PendingDetailRow, 'case_id' | 'kind'>;
        Update: Partial<Pick<PendingDetailRow, 'answered_at' | 'dismissed_at'>>;
        Relationships: [
          {
            foreignKeyName: 'pending_details_case_id_fkey';
            columns: ['case_id'];
            isOneToOne: false;
            referencedRelation: 'cases';
            referencedColumns: ['id'];
          },
        ];
      };
      processing_times: {
        Row: ProcessingTimeRow;
        Insert: ProcessingTimeRow;
        Update: Partial<ProcessingTimeRow>;
        Relationships: [];
      };
      reminders: {
        Row: ReminderRow;
        Insert: Partial<ReminderRow> & Pick<ReminderRow, 'case_id' | 'kind' | 'due_on'>;
        Update: Partial<ReminderRow>;
        Relationships: [
          {
            foreignKeyName: 'reminders_case_id_fkey';
            columns: ['case_id'];
            isOneToOne: false;
            referencedRelation: 'cases';
            referencedColumns: ['id'];
          },
        ];
      };
      analytics_events: {
        Row: AnalyticsEventRow;
        Insert: Pick<AnalyticsEventRow, 'user_id' | 'event_name'>;
        Update: never;
        Relationships: [
          {
            foreignKeyName: 'analytics_events_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: {
      record_interval: {
        Args: {
          p_form_type: string;
          p_office_code: string;
          p_from_kind: string;
          p_to_kind: string;
          p_days: number;
        };
        Returns: undefined;
      };
      get_stage_estimate: {
        Args: {
          p_form_type: string;
          p_office_code: string;
          p_from_kind: string;
          p_to_kind?: string;
        };
        Returns: { sample_size: number; median_days: number | null }[];
      };
    };
  };
}
