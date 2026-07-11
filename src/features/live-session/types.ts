export type Message = {
  who: string;
  side: "user" | "agent";
  text: string;
};
