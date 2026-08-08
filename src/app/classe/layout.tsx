export default function ClasseLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="classroom-shell classroom-shell-without-header">
      <main className="classroom-main classroom-main-without-header">
        {children}
      </main>
    </div>
  );
}
