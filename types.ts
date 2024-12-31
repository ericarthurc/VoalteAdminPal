export interface VoalteResponseJSON {
  sid: number;
  session_token: string;
  user_type: string;
  user_id: number;
}

export type VoalteSelection =
  | "ALL_USERS"
  | "VOALTE_ME_SESSIONS"
  | "VOALTE_ME_EXCEL"
  | "SESSION_TOKEN"
  | "EXIT";
