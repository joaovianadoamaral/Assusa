Write-Host "🚀 Configurando projeto Assusa..." -ForegroundColor Cyan

# Verificar se Node.js está instalado
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Node.js não encontrado. Instale Node.js 20+ primeiro." -ForegroundColor Red
    exit 1
}

# Instalar dependências
Write-Host "📦 Instalando dependências..." -ForegroundColor Yellow
npm install

# Criar .env a partir do exemplo
if (-not (Test-Path .env)) {
    Write-Host "📝 Criando arquivo .env a partir do .env.example..." -ForegroundColor Yellow
    Copy-Item .env.example .env
    Write-Host "✅ Arquivo .env criado!" -ForegroundColor Green
    Write-Host "⚠️  IMPORTANTE: Edite o arquivo .env e preencha todas as variáveis obrigatórias" -ForegroundColor Yellow
    Write-Host "   Especialmente: CPF_PEPPER (gere com PowerShell)" -ForegroundColor Yellow
} else {
    Write-Host "ℹ️  Arquivo .env já existe, pulando criação..." -ForegroundColor Blue
}

# Compilar projeto
Write-Host "🔨 Compilando projeto..." -ForegroundColor Yellow
npm run build

Write-Host "✅ Setup concluído!" -ForegroundColor Green
Write-Host ""
Write-Host "Próximos passos:" -ForegroundColor Cyan
Write-Host "1. Edite o arquivo .env e preencha todas as variáveis"
Write-Host "2. Execute: npm start (ou npm run dev para desenvolvimento)"
