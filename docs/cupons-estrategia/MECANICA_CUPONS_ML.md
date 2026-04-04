# Mecânica de Cupons do Mercado Livre

> Documentação baseada em testes reais feitos em 04/04/2026 com o produto Tênis Oakley Flak 365 II Lite.

---

## 1. Tipos de Cupons no ML

### 1.1 Cupons Automáticos (sem código)
- Aparecem automaticamente no **checkout**
- O cliente só precisa clicar em **"Aplicar"**
- São criados pela **plataforma ML** (não pelo vendedor)
- Vinculados a **categorias** (ex: MODA FULL, BELEZA, CASA)
- Possuem **limite de economia** (ex: Limite de R$ 150)
- Disponíveis na página pública: `mercadolivre.com.br/cupons/`

### 1.2 Cupons com Código
- O cliente digita o código no campo **"Inserir código do cupom"**
- São os mesmos cupons públicos, mas inseridos manualmente
- Códigos como: `M3L1V1P12X`, `DENNISDJ10`, `HOJETEMPROMO`, `CUPOMPRAMODA`

### 1.3 Cupons do Vendedor
- Criados pelo vendedor via API `/seller-promotions`
- Podem ser com ou sem código
- Tipos: `FIXED_AMOUNT` (valor fixo) ou `FIXED_PERCENTAGE` (percentual)

---

## 2. Regra Fundamental: SÓ 1 CUPOM POR COMPRA

### Teste Real (04/04/2026)

**Produto:** Tênis Oakley Flak 365 II Lite  
**Preço no checkout:** R$ 386,99

**3 cupons disponíveis no checkout:**
| # | Cupom | Categoria | Limite |
|---|---|---|---|
| 1 | 15% OFF em MODA FULL | Produtos selecionados | R$ 150 |
| 2 | 10% OFF em MODA FULL | Produtos selecionados | R$ 150 |
| 3 | 10% OFF em MODA FULL | Produtos selecionados | R$ 150 |

**Resultado ao clicar nos 3:**
- Cupom 1 (15%): ✅ **Aplicado** → "Economize R$ 58,05"
- Cupom 2 (10%): ✅ "Aplicado" → **"Você já aplicou um cupom melhor. Use este na próxima compra."**
- Cupom 3 (10%): ✅ "Aplicado" → **"Você já aplicou um cupom melhor. Use este na próxima compra."**

**Prova matemática:**
```
Desconto cobrado:  R$ 58,05
15% de R$ 386,99 = R$ 58,05  ✅ Apenas o 15% foi aplicado

Se 3 fossem compostos: desconto seria R$ 120,55 → total R$ 291,43
Se 3 fossem somados (35%): desconto seria R$ 135,45 → total R$ 276,53
Checkout real: R$ 353,93 → CONFIRMA que só 1 cupom foi aplicado
```

### Conclusão
- O ML marca todos como "Aplicado ✓" mas só o MELHOR é efetivamente usado
- Os outros ficam **reservados para compras futuras**
- "Aplicado ✓" = resgatado/ativado na conta, NÃO aplicado na compra atual

---

## 3. Cálculo de Descontos (Compostos, NUNCA Somados)

### Regra de Ouro
> Descontos são **compostos**, nunca somados.

### Ordem de Aplicação
1. **Desconto do anúncio** (aplicado primeiro pelo ML)
2. **Cupom** (aplicado sobre o preço JÁ reduzido)
3. **Pix** (desconto adicional sobre o total)

### Fórmula
```
Desconto real = 1 - (1 - d1) × (1 - d2)
```

### Exemplo Real (Oakley)
```
Preço original:           R$ 749,90
Desconto do anúncio (48%): R$ 749,90 × 0.52 = R$ 386,99
Cupom 15% OFF:             R$ 386,99 × 0.85 = R$ 328,94
Desconto real total:       1 - (R$ 328,94 / R$ 749,90) = 56% OFF

Desconto real ≠ 48% + 15% = 63%
Desconto real  = 56% (composto)
```

---

## 4. Sobre Frete nos Posts

**NÃO incluir frete nos posts.** Motivos:
- Frete varia por localização do cliente
- Em SP e regiões próximas a centros FULL: geralmente **grátis**
- Incluir frete confunde e pode afastar quem tem frete grátis
- O post deve focar no **preço do produto + cupom**

---

## 5. Onde Encontrar Cupons

### Página Pública de Cupons
- URL: `https://www.mercadolivre.com.br/cupons/`
- Lista todos os cupons ativos por categoria
- Qualquer pessoa pode resgatar
- Atualizada frequentemente (verificar diariamente)

### Tipos de Campanhas na Página
- **Cupons Meli** (ex: 18% OFF, 15% OFF) — campanhas com data de ativação futura
- **Cupons de categoria** (ex: MODA FULL, BELEZA)
- **Cupons gerais** — aplicáveis em múltiplas categorias

### Cupons Futuros
- Algumas campanhas mostram produtos com badge "Cupom 15% OFF" antes da ativação
- Os produtos já estão listados, mas o cupom só ativa na data programada
- **Estratégia**: preparar os posts ANTES e publicar quando o cupom ativar

---
