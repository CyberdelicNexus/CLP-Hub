import { FilmPlayer } from "@/components/landing/film-player";
import { Missing } from "@/components/landing/missing";
import { Signal } from "@/components/landing/signal";
import { WHAT, WHY } from "@/content/landing/clear-light";

/**
 * Sections 2 and 3 share one light. It rests half outside the bottom centre of
 * "El porqué", which is the same place as half outside the top centre of
 * "El qué": one element at the seam, one diameter token (--cl-light), and the
 * size cannot change between the two states because there is only one.
 */
export function Why() {
  return (
    <section id="porque" className="porque" data-sc-act="flow" aria-labelledby="porque-title">
      <div className="porque__inner">
        <h2 id="porque-title" className="cl-title">
          {WHY.headline}
        </h2>
        <p className="cl-lead porque__body">{WHY.body}</p>
      </div>
      <Signal className="porque__light" breath />
    </section>
  );
}

export function What() {
  return (
    <section id="que" className="que" aria-labelledby="que-title">
      <div className="que__grid">
        <div>
          <h2 id="que-title" className="cl-title">
            {WHAT.headline}
          </h2>
          <p className="cl-lead que__body">{WHAT.body}</p>
          <ul className="facts">
            {WHAT.facts.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        </div>
        <div>
          <FilmPlayer
            src="/landing/media/film.mp4"
            poster="/landing/media/film-poster.webp"
            alt={WHAT.film.description}
            label={WHAT.film.label}
            playLabel={WHAT.film.play}
            errorLabel="El vídeo no se ha podido cargar. La descripción de abajo resume su contenido."
          />
          <p className="film__meta">
            <span>{WHAT.film.context}</span>
            <Missing item={WHAT.film.captions} />
          </p>
          <p className="film__desc">{WHAT.film.description}</p>
        </div>
      </div>
    </section>
  );
}
