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
  const [loaded, setLoaded] = useState(false);

  const id = count > 0 ? pokemonId(count) : null;

  // Precarga el siguiente para que el cambio sea inmediato.
  useEffect(() => {
    const preload = new window.Image();
    preload.src = spriteUrl(pokemonId(count + 1));
  }, [count]);

  function handleClick() {
    setLoaded(false);
    setCount((c) => c + 1);
  }

  return (
    <section className={styles.wrap}>
      <div className={styles.screen} aria-live="polite">
        {id === null ? (
          <p className={styles.empty}>
            Pulsa el botón para encontrar tu primer Pokémon.
          </p>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={id}
            className={`${styles.sprite} ${loaded ? styles.spriteIn : ''}`}
            src={spriteUrl(id)}
            alt={`Pokémon número ${id}`}
            width={475}
            height={475}
            onLoad={() => setLoaded(true)}
          />
        )}
        {id !== null && (
          <span className={styles.dexNumber}>
            N.º {String(id).padStart(4, '0')}
          </span>
        )}
      </div>

      <p className={styles.count} aria-label={`Contador: ${count}`}>
        {count}
      </p>

      <button type="button" className={styles.button} onClick={handleClick}>
        Sumar uno
      </button>
    </section>
  );
}
