export default function App() {
  return (
    <main className="page">
      <section className="scene">
        <img src="/cozy.svg" alt="A cozy pixel room: playing the poodle game on the family TV" />
      </section>

      <section className="scene">
        <a href="https://github.com/ivasik-k7?tab=repositories" aria-label="Star my repositories on GitHub">
          <img src="/cozy-star.svg" alt="Inside the game: a cursor clicks the star" />
        </a>
      </section>

      <footer className="footer">
        <a href="https://github.com/ivasik-k7">github</a>
        <span className="dot">▪</span>
        <a href="https://www.linkedin.com/in/ivan-kovtun/">linkedin</a>
        <span className="dot">▪</span>
        <span className="mark">© ivasik-k7</span>
      </footer>
    </main>
  );
}
