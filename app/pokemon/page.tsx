import type { Metadata } from 'next';
import PokemonCounter from './PokemonCounter';

export const metadata: Metadata = {
  title: 'Contador Pokémon · Arcade Vault',
  description: 'Haz clic y descubre un Pokémon distinto con cada número.',
};

export default function PokemonPage() {
  return <PokemonCounter />;
}
