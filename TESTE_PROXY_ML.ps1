# ========================================
# 🧪 TESTE COMPLETO - PROXY + MERCADO LIVRE
# ========================================

Write-Host ""
Write-Host "=========================================="
Write-Host "🧪 TESTE PROXY RESIDENCIAL + ML"
Write-Host "=========================================="
Write-Host ""

# Aguardar deploy
Write-Host "⏰ Aguardando deploy completar (180 segundos)..."
Write-Host ""
Start-Sleep -Seconds 180

Write-Host "✅ Deploy deve estar completo. Testando..."
Write-Host ""

# ==========================================
# TESTE 1: Health Check
# ==========================================
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
Write-Host "TESTE 1: Health Check"
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
Write-Host ""

try {
    $health = Invoke-RestMethod -Uri 'https://promo-platform-api.onrender.com/health'
    Write-Host "✅ API Online"
    Write-Host "   Status: $($health.status)"
    Write-Host ""
} catch {
    Write-Host "❌ API Offline"
    Write-Host "   Aguarde mais alguns minutos..."
    exit
}

# ==========================================
# TESTE 2: Conexão ML (OAuth)
# ==========================================
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
Write-Host "TESTE 2: Conexão ML (OAuth)"
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
Write-Host ""

try {
    $connection = Invoke-RestMethod -Uri 'https://promo-platform-api.onrender.com/api/ml/connection'
    Write-Host "✅ OAuth Funcionando"
    Write-Host "   Username: $($connection.mlNickname)"
    Write-Host "   Email: $($connection.mlEmail)"
    Write-Host "   Expira em: $($connection.expiresIn) segundos"
    Write-Host ""
} catch {
    Write-Host "❌ Erro no OAuth"
    Write-Host "   Reconecte a conta ML"
    Write-Host ""
}

# ==========================================
# TESTE 3: /me (Identidade)
# ==========================================
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
Write-Host "TESTE 3: Identidade ML (/me)"
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
Write-Host ""

try {
    $me = Invoke-RestMethod -Uri 'https://promo-platform-api.onrender.com/api/ml/me'
    Write-Host "✅ Identidade OK"
    Write-Host "   ID: $($me.data.id)"
    Write-Host "   Nome: $($me.data.first_name) $($me.data.last_name)"
    Write-Host "   País: $($me.data.country_id)"
    Write-Host ""
} catch {
    Write-Host "❌ Erro ao buscar identidade"
    Write-Host ""
}

# ==========================================
# TESTE 4: 🎯 BUSCA ML (COM PROXY!)
# ==========================================
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
Write-Host "TESTE 4: 🎯 BUSCA ML (COM PROXY!)"
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
Write-Host ""

try {
    $search = Invoke-RestMethod -Uri 'https://promo-platform-api.onrender.com/api/ml/public-search?query=iphone&limit=5'
    
    Write-Host "✅✅✅ FUNCIONOU! PROXY DESBLOQUEOU ML!"
    Write-Host ""
    Write-Host "Total de produtos: $($search.total)"
    Write-Host "Mostrando: $($search.items.Count) primeiros"
    Write-Host ""
    
    $i = 1
    foreach ($item in $search.items) {
        $titleShort = if ($item.title.Length -gt 50) { $item.title.Substring(0, 50) + "..." } else { $item.title }
        Write-Host "[$i] $titleShort"
        Write-Host "    Preço: R$ $($item.price)"
        if ($item.original_price -and $item.original_price -gt 0) {
            $discount = [math]::Round((($item.original_price - $item.price) / $item.original_price) * 100, 0)
            Write-Host "    De: R$ $($item.original_price) (Desconto: $discount%)"
        }
        Write-Host "    Vendedor: $($item.seller.nickname)"
        if ($item.shipping.free_shipping) {
            Write-Host "    🚚 FRETE GRÁTIS"
        }
        Write-Host ""
        $i++
    }
    
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    Write-Host "🎉 SUCESSO TOTAL! ML DESBLOQUEADO!"
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    Write-Host ""
    Write-Host "Próximos passos:"
    Write-Host "1. ✅ Buscar produtos funcionando"
    Write-Host "2. ✅ Implementar coleta automática"
    Write-Host "3. ✅ Começar a operar!"
    Write-Host ""
    
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    Write-Host "❌ Erro ao buscar produtos"
    Write-Host "   Status: $statusCode"
    Write-Host ""
    
    if ($statusCode -eq 403) {
        Write-Host "⚠️  Ainda bloqueado (403)"
        Write-Host ""
        Write-Host "Possíveis causas:"
        Write-Host "- Proxy não configurado corretamente"
        Write-Host "- Deploy ainda não completou"
        Write-Host "- IPRoyal precisa ativar região Brasil"
        Write-Host ""
        Write-Host "Verifique:"
        Write-Host "1. PROXY_URL está no Render?"
        Write-Host "2. Deploy completou? (status Live)"
        Write-Host "3. IPRoyal está com crédito?"
        Write-Host ""
    } elseif ($statusCode -eq 500) {
        Write-Host "⚠️  Erro interno (500)"
        Write-Host ""
        Write-Host "Verifique os logs do Render:"
        Write-Host "https://dashboard.render.com/web/srv-d5nrh45actks73cmr8b0/logs"
        Write-Host ""
    }
}

# ==========================================
# TESTE 5: Busca alternativa (notebook)
# ==========================================
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
Write-Host "TESTE 5: Busca alternativa (notebook)"
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
Write-Host ""

try {
    $search2 = Invoke-RestMethod -Uri 'https://promo-platform-api.onrender.com/api/ml/public-search?query=notebook&limit=3'
    
    Write-Host "✅ Busca 2 funcionou!"
    Write-Host "Total: $($search2.total) produtos"
    Write-Host ""
    
    $search2.items | Select-Object -First 3 | ForEach-Object {
        $titleShort = if ($_.title.Length -gt 50) { $_.title.Substring(0, 50) + "..." } else { $_.title }
        Write-Host "- $titleShort"
        Write-Host "  R$ $($_.price)"
    }
    Write-Host ""
    
} catch {
    Write-Host "❌ Busca 2 falhou"
    Write-Host ""
}

# ==========================================
# RESUMO FINAL
# ==========================================
Write-Host ""
Write-Host "=========================================="
Write-Host "📊 RESUMO DOS TESTES"
Write-Host "=========================================="
Write-Host ""
Write-Host "Execute este script novamente para re-testar:"
Write-Host ".\TESTE_PROXY_ML.ps1"
Write-Host ""
Write-Host "Ou teste manualmente:"
Write-Host 'Invoke-RestMethod -Uri "https://promo-platform-api.onrender.com/api/ml/public-search?query=iphone&limit=3"'
Write-Host ""
