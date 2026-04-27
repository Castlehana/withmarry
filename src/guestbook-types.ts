export type GuestbookSide = "groom" | "bride";

export type GuestbookEntry = {
  id: string;
  weddingId: string;
  side: GuestbookSide;
  authorName: string;
  body: string;
  createdAt: string;
};
