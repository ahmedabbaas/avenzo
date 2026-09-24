import BrandLogo from "../../components/brand-logo";

export default function AuthBrandPanel({
  context = "PRIVATE-FIRST SOCIAL",
}: {
  context?: string;
}) {
  return (
    <section className="auth-brand-panel">
      <div className="auth-brand">
        <BrandLogo size={54} priority />
        <div>
          <strong>AVENZO</strong>
          <span>Connect. Share. Belong.</span>
        </div>
      </div>

      <div className="auth-story">
        <div className="eyebrow">{context}</div>
        <h2>A social space built around identity, not noise.</h2>
        <p>
          Your unique username, your people, your posts and your conversations
          stay connected to one real account.
        </p>

        <div className="auth-feature-list">
          <div>
            <i>01</i>
            <span>
              <b>Unique identity</b>
              <small>One permanent @username per account.</small>
            </span>
          </div>
          <div>
            <i>02</i>
            <span>
              <b>Private conversations</b>
              <small>Direct messages stay between participants.</small>
            </span>
          </div>
          <div>
            <i>03</i>
            <span>
              <b>Real social graph</b>
              <small>Follow people, publish posts and build your feed.</small>
            </span>
          </div>
        </div>
      </div>

      <small className="auth-brand-foot">AVENZO · built for people, not demo accounts</small>
    </section>
  );
}
