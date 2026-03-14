// Auto-gerado por splitPhrases.mjs — NÃO editar manualmente
// Importa e combina todos os pools de frases

import { PHRASES_ELETRONICOS } from './eletronicos';
import { PHRASES_GAMES } from './games';
import { PHRASES_MODA } from './moda';
import { PHRASES_BELEZA } from './beleza';
import { PHRASES_CASA } from './casa';
import { PHRASES_FERRAMENTAS } from './ferramentas';
import { PHRASES_ESPORTES } from './esportes';
import { PHRASES_ALIMENTACAO } from './alimentacao';
import { PHRASES_SAUDE } from './saude';
import { PHRASES_BEBES } from './bebes';
import { PHRASES_INFANTIL } from './infantil';
import { PHRASES_PET } from './pet';
import { PHRASES_AUTOMOTIVO } from './automotivo';
import { PHRASES_LIVROS } from './livros';
import { PHRASES_PAPELARIA } from './papelaria';
import { PHRASES_TECH_CRIADORES } from './tech_criadores';
import { PHRASES_TECH_SMART } from './tech_smart';
import { PHRASES_VIAGEM } from './viagem';
import { PHRASES_GENERICOS } from './genericos';
import { PHRASES_OUTROS } from './outros';
import { PHRASES_ANIME } from './anime';

export const PRODUCT_SPECIFIC_PHRASES: Record<string, string[]> = {
  ...PHRASES_ELETRONICOS,
  ...PHRASES_GAMES,
  ...PHRASES_MODA,
  ...PHRASES_BELEZA,
  ...PHRASES_CASA,
  ...PHRASES_FERRAMENTAS,
  ...PHRASES_ESPORTES,
  ...PHRASES_ALIMENTACAO,
  ...PHRASES_SAUDE,
  ...PHRASES_BEBES,
  ...PHRASES_INFANTIL,
  ...PHRASES_PET,
  ...PHRASES_AUTOMOTIVO,
  ...PHRASES_LIVROS,
  ...PHRASES_PAPELARIA,
  ...PHRASES_TECH_CRIADORES,
  ...PHRASES_TECH_SMART,
  ...PHRASES_VIAGEM,
  ...PHRASES_GENERICOS,
  ...PHRASES_OUTROS,
  ...PHRASES_ANIME,
};
