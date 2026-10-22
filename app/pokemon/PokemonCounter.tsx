'use client';

import { useEffect, useState } from 'react';
import styles from './pokemon.module.css';

const TOTAL_POKEMON = 1025;
const spriteUrl = (id: number) =>
  `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`;

// El contador sigue subiendo; el Pokémon da la vuelta al llegar al último.
const pokemonId = (count: number) => ((count - 1) % TOTAL_POKEMON) + 1;

export default function PokemonCounter() {
  const [count, setCount] = useState(0);
  const [loadedId, setLoadedId] = useState<number | null>(null);

  const id = count > 0 ? pokemonId(count) : null;

  // Precarga el siguiente para que el cambio sea inmediato.
  useEffect(() => {
    new window.Image().src = spriteUrl(pokemonId(count + 1));
  }, [count]);

  return (
    <section className={styles.wrap}>
      <div className={styles.screen} aria-live="polite">
        {id === null ? (
          <p className={styles.empty}>
            Pulsa el botón para encontrar tu primer Pokémon.
          </p>
        ) : (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              key={id}
              className={`${styles.sprite} ${loadedId === id ? styles.spriteIn : ''}`}
              src={spriteUrl(id)}
              alt={`Pokémon número ${id}`}
              width={475}
              height={475}
              onLoad={() => setLoadedId(id)}
            />
            <span className={styles.dexNumber}>
              N.º {String(id).padStart(4, '0')}
            </span>
          </>
        )}
      </div>

      <p className={styles.count} aria-label={`Contador: ${count}`}>
        {count}
      </p>

      <button
        type="button"
        className={styles.button}
        onClick={() => setCount((c) => c + 1)}
      >
        Sumar uno
      </button>
    </section>
  );
}
