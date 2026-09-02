export interface PageIssue {
  type:
    | "missing_title"
    | "missing_meta_description"
    | "missing_canonical"
    | "missing_h1"
    | "multiple_h1"
    | "missing_alt_text"
    | "noindex"
    | "non_ok_status"
    | "broken_internal_link";
  detail: string;
}
