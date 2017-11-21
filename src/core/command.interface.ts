export interface Command {
  description: string;
  guid: string;
  name: string;
  options?: Array<{ name: string; value: any; }>;
  pid: number;
  script: string;
  type: string;
  value: string;
}