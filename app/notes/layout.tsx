import { NotesCommandMenu } from "@/components/notes/notes-command-menu";

export default function NotesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {children}
      <NotesCommandMenu />
    </>
  );
}
