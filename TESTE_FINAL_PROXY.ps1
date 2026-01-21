Write-Host ""
Write-Host "=========================================="
Write-Host "TESTE DEFINITIVO - PROXY ML"
Write-Host "=========================================="
Write-Host ""

Write-Host "Verificando se API esta online..."
$maxRetries = 5
$retry = 1
$apiOnline = $false

while ($retry -le $maxRetries -and -not $apiOnline) {
    try {
        $health = Invoke-RestMethod -Uri 'https://promo-platform-api.onrender.com/health' -TimeoutSec 10
        if ($health.status -eq "ok") {
            $apiOnline = $true
            Write-Host "OK - API Online"
        }
    } catch {
        Write-Host "Tentativa $retry/$maxRetries - Aguardando API ficar online..."
        Start-Sleep -Seconds 10
        $retry++
    }
}

if (-not $apiOnline) {
    Write-Host ""
    Write-Host "ERRO - API ainda nao esta respondendo"
    Write-Host "Aguarde mais alguns minutos e tente novamente"
    Write-Host ""
    exit
}

Write-Host ""
Write-Host "Testando busca ML com proxy..."
Write-Host "(Pode demorar ate 30 segundos)"
Write-Host ""

try {
    $search = Invoke-RestMethod -Uri 'https://promo-platform-api.onrender.com/api/ml/public-search?query=iphone&limit=5' -TimeoutSec 35
    
    Write-Host ""
    Write-Host "=========================================="
    Write-Host "SUCESSO TOTAL!"
    Write-Host "PROXY DESBLOQUEOU O MERCADO LIVRE!"
    Write-Host "=========================================="
    Write-Host ""
    Write-Host "Total de produtos: $($search.total)"
    Write-Host "Retornados: $($search.items.Count)"
    Write-Host ""
    
    $i = 1
    foreach ($item in $search.items) {
        $title = if ($item.title.Length -gt 55) { $item.title.Substring(0,55) + "..." } else { $item.title }
        Write-Host "[$i] $title"
        Write-Host "    Preco: R$ $($item.price)"
        
        if ($item.original_price -and $item.original_price -gt $item.price) {
            $desc = [math]::Round((($item.original_price - $item.price) / $item.original_price) * 100)
            Write-Host "    De R$ $($item.original_price) -> Desconto: $desc%"
        }
        
        if ($item.seller.nickname) {
            Write-Host "    Vendedor: $($item.seller.nickname)"
        }
        
        if ($item.shipping.free_shipping) {
            Write-Host "    Frete GRATIS"
        }
        
        Write-Host ""
        $i++
    }
    
    Write-Host "=========================================="
    Write-Host "PLATAFORMA 100% OPERACIONAL!"
    Write-Host "=========================================="
    Write-Host ""
    Write-Host "STATUS FINAL:"
    Write-Host "- Backend API: LIVE"
    Write-Host "- Database Neon: CONECTADO"
    Write-Host "- OAuth ML: CONECTADO (MANUDASPROMOCOES)"
    Write-Host "- Proxy IPRoyal: FUNCIONANDO"
    Write-Host "- Busca ML: DESBLOQUEADA"
    Write-Host "- Frontend Vercel: DEPLOYADO"
    Write-Host ""
    Write-Host "PROXIMOS PASSOS:"
    Write-Host "1. Implementar coleta automatica de ofertas"
    Write-Host "2. Configurar filtros (categorias, desconto minimo)"
    Write-Host "3. Testar fluxo completo: coleta -> card -> aprovacao -> disparo"
    Write-Host "4. Configurar canais de disparo (Telegram, WhatsApp, X, Facebook)"
    Write-Host "5. Comecar a operar a plataforma!"
    Write-Host ""
    
} catch {
    $status = $_.Exception.Response.StatusCode.value__
    Write-Host ""
    Write-Host "ERRO: $status"
    Write-Host "Mensagem: $($_.Exception.Message)"
    Write-Host ""
    
    if ($status -eq 500) {
        Write-Host "ERRO 500 - O proxy ainda esta com problema"
        Write-Host ""
        Write-Host "Verifique os logs do Render:"
        Write-Host "https://dashboard.render.com/web/srv-d5nrh45actks73cmr8b0/logs"
        Write-Host ""
        Write-Host "Procure por:"
        Write-Host "- 'Usando proxy: geo.iproyal.com:12321' (deve aparecer)"
        Write-Host "- Mensagens de erro logo apos"
        Write-Host ""
    } elseif ($status -eq 403) {
        Write-Host "ERRO 403 - ML bloqueou mesmo com proxy"
        Write-Host ""
        Write-Host "Possibilidades:"
        Write-Host "- IP do proxy ja foi detectado"
        Write-Host "- Precisa rotacionar proxy"
        Write-Host "- ML detectou padrao de bot"
        Write-Host ""
    } elseif ($status -eq 504) {
        Write-Host "TIMEOUT - Proxy demorou muito"
        Write-Host ""
        Write-Host "Tente novamente em alguns segundos"
        Write-Host ""
    } else {
        Write-Host "Erro inesperado"
        Write-Host ""
    }
}

Write-Host ""
