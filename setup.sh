#!/bin/bash

echo "🚀 Configurando projeto Assusa..."

# Verificar se Node.js está instalado
if ! command -v node &> /dev/null; then
    echo "❌ Node.js não encontrado. Instale Node.js 20+ primeiro."
    exit 1
fi

# Instalar dependências
echo "📦 Instalando dependências..."
npm install

# Criar .env a partir do exemplo
if [ ! -f .env ]; then
    echo "📝 Criando arquivo .env a partir do .env.example..."
    cp .env.example .env
    echo "✅ Arquivo .env criado!"
    echo "⚠️  IMPORTANTE: Edite o arquivo .env e preencha todas as variáveis obrigatórias"
    echo "   Especialmente: CPF_PEPPER (gere com: openssl rand -hex 32)"
else
    echo "ℹ️  Arquivo .env já existe, pulando criação..."
fi

# Compilar projeto
echo "🔨 Compilando projeto..."
npm run build

echo "✅ Setup concluído!"
echo ""
echo "Próximos passos:"
echo "1. Edite o arquivo .env e preencha todas as variáveis"
echo "2. Execute: npm start (ou npm run dev para desenvolvimento)"
