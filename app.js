// Variáveis globais para controle do pagamento
let currentTransactionId = null;
let paymentCheckInterval = null;
let paymentCheckAttempts = 0;
let selectedDonationAmount = 0;
// Constantes para verificação
const MAX_PAYMENT_CHECKS = 180; // 15 minutos (180 tentativas * 5 segundos)
const PAYMENT_CHECK_INTERVAL = 5000; // 5 segundos

let lastScrollTop = 0;
const stickyButton = document.getElementById('stickyButton');

window.addEventListener('scroll', function () {
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;

    if (scrollTop > 800) {
        stickyButton.classList.remove('hidden');
    } else {
        stickyButton.classList.add('hidden');
    }

    lastScrollTop = scrollTop;
});

// Modal functions
function openDonationModal() {
    document.getElementById('donationModal').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

function closeDonationModal() {
    document.getElementById('donationModal').classList.add('hidden');
    document.body.style.overflow = 'auto';
}

// Close modal on backdrop click
document.getElementById('donationModal').addEventListener('click', function (e) {
    if (e.target === this) {
        closeDonationModal();
    }
});

// Close modal on escape key
document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
        closeDonationModal();
    }
});



function selectCustomAmount() {
    const customAmount = document.getElementById('customAmount').value;
    if (customAmount && parseFloat(customAmount) > 0) {
        alert(`Você selecionou doar R$ ${parseFloat(customAmount).toFixed(2).replace('.', ',')}. Em um sistema real, isso redirecionaria para o pagamento.`);
    } else {
        alert('Por favor, insira um valor válido.');
    }
}

function shareOnFacebook() {
    const url = encodeURIComponent(window.location.href);
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${url}`, '_blank', 'width=600,height=400');
}

function shareOnWhatsApp() {
    const text = encodeURIComponent('Ajude o Jonatan a viver com dignidade! Ele trabalha rastejando todos os dias e precisa de próteses.');
    const url = encodeURIComponent(window.location.href);
    window.open(`https://wa.me/?text=${text}%20${url}`, '_blank');
}

function shareOnTwitter() {
    const text = encodeURIComponent('Ajude o Jonatan a viver com dignidade!');
    const url = encodeURIComponent(window.location.href);
    window.open(`https://twitter.com/intent/tweet?text=${text}&url=${url}`, '_blank', 'width=600,height=400');
}

//funcão para tracker um initiate checkout 

function trackInitiateCheckout(amount, currency = 'BRL') {
    if (typeof fbq !== 'undefined') {
        fbq('track', 'InitiateCheckout', {
            value: amount,
            currency: currency,
            content_type: 'donation',
            content_name: 'Doação para Jonatan'
        });
    }
}


// função para trackear Purchase

function trackPurchase(amount, currency = 'BRL'){
    if( typeof fbq !== 'undefined'){
        fbq('track', 'Purchase',{
            value:amount,
            currency:currency,
            content_type:'donation',
            content_name:'Doação para Jonatan'
        })
    }
}

// FETCH API PAYMENT

let dataShow = true

async function generatePix(amount) {

    const url = 'https://api-node-teal-nine.vercel.app/create-transaction'
    showLoadingSpinner()
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                amount_cents: amount * 100
            })
        })

        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Erro ao gerar PIX:', error);
        hideLoadingSpinner();
        alert('Erro ao gerar código PIX. Por favor, tente novamente.');
        throw error;
    }


}
//OPEN PIX MODAL
async function openPixModal(amount, codeQR) {
    console.log('🔄 Opening PIX modal for amount:', amount);

    //fecha modal de doação
    closeDonationModal();
    //mostra spinner
    showLoadingSpinner();

    try {
        const pixData = await generatePix(amount)

        hideLoadingSpinner();

        updatePixModal(amount, pixData);
        document.getElementById('pixModal').classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    } catch (error) {
        // Esconde o spinner em caso de erro
        hideLoadingSpinner();

        alert('Erro ao gerar código PIX. Por favor, tente novamente.');
        console.error('Erro no openPixModal:', error);
    }


}

// pix Modal update

// Update PIX modal with data - AJUSTADA PARA SEU FORMATO
function updatePixModal(amount, pixData) {
    console.log('📊 Atualizando modal PIX com dados:', pixData);

    // Atualiza o valor
    const amountElement = document.getElementById('pixAmount');
    if (amountElement) {
        amountElement.textContent = amount.toFixed(2).replace('.', ',');
        console.log('✅ Valor atualizado: R$', amount);
    }

    // Atualiza o QR Code - usando qrcode_text para gerar imagem
    const qrCodeImg = document.getElementById('pixQrCode');
    if (qrCodeImg && pixData.qrcode_text) {
        // Gera QR Code usando API externa com o texto do PIX
        const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(pixData.qrcode_text)}&margin=10`;
        qrCodeImg.src = qrCodeUrl;
        qrCodeImg.alt = `QR Code PIX - R$ ${amount.toFixed(2)}`;
        console.log('✅ QR Code gerado a partir de qrcode_text');
    }

    // Atualiza o código PIX copiável
    const pixCodeElement = document.getElementById('pixCode');
    if (pixCodeElement && pixData.qrcode_text) {
        pixCodeElement.value = pixData.qrcode_text;
        console.log('✅ Código PIX definido (qrcode_text)');
    }

    // Atualiza a data de expiração
    const expiresElement = document.getElementById('pixExpires');
    if (expiresElement) {
        // PIX geralmente expira em 1 hora
        const oneHourLater = new Date(Date.now() + 60 * 60 * 1000);
        expiresElement.textContent = `⏰ Expira às ${oneHourLater.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
        expiresElement.className = "text-sm text-blue-600 font-medium";

        // Se quiser mostrar o transaction_id também:
        if (pixData.transaction_id) {
            const transactionInfo = document.getElementById('transactionInfo') || createTransactionInfoElement();
            transactionInfo.textContent = `ID da transação: ${pixData.transaction_id}`;
            console.log('✅ Transaction ID:', pixData.transaction_id);
        }
    }

    console.log('✅ Modal PIX atualizado com sucesso!');
}

// Função auxiliar para criar elemento de transaction info
function createTransactionInfoElement() {
    const container = document.querySelector('#pixModal .text-center');
    if (container) {
        const infoElement = document.createElement('p');
        infoElement.id = 'transactionInfo';
        infoElement.className = 'text-xs text-gray-500 mt-2';
        container.appendChild(infoElement);
        return infoElement;
    }
    return null;
}

function showLoadingSpinner() {
    const spinner = document.getElementById('loadingSpinner');
    if (spinner) {
        spinner.classList.remove('hidden');
        // Previne scroll do body enquanto spinner está visível
        document.body.style.overflow = 'hidden';
    }
}

function hideLoadingSpinner() {
    const spinner = document.getElementById('loadingSpinner');
    if (spinner) {
        spinner.classList.add('hidden');
        // Restaura scroll do body
        document.body.style.overflow = 'auto';
    }
}
// Atualize closePixModal para parar todas as verificações
function closePixModal() {
    console.log('👋 Fechando modal PIX');
    
    // Para todas as verificações
    stopPaymentVerification();
    
    // Limpa qualquer intervalo pendente
    if (paymentCheckInterval) {
        clearInterval(paymentCheckInterval);
        paymentCheckInterval = null;
    }
    
    // Fecha o modal
    document.getElementById('pixModal').classList.add('hidden');
    document.body.style.overflow = 'auto';
    
    // Limpa o status
    const paymentStatus = document.getElementById('paymentStatus');
    if (paymentStatus) {
        paymentStatus.innerHTML = '';
        paymentStatus.classList.add('hidden');
    }
    
    console.log('✅ Modal PIX fechado e verificações paradas');
}

// Para verificação de pagamento
function stopPaymentVerification() {
    if (paymentCheckInterval) {
        clearInterval(paymentCheckInterval);
        paymentCheckInterval = null;
        console.log('🛑 Verificação de pagamento interrompida');
    }
}
// Variável global para armazenar o valor selecionado


// Donation amount selection
function selectAmount(amount) {
    trackInitiateCheckout(amount)
    selectedDonationAmount = amount;
    closeDonationModal();


    //alert(`Você selecionou doar R$ ${amount.toFixed(2).replace('.', ',')}. Em um sistema real, isso redirecionaria para o pagamento.`);
    setTimeout(() => {
        openPixModal(selectedDonationAmount);
    }, 100)


}


///copiar código pix

function copyPixCode() {
    const pixCodeElement = document.getElementById('pixCode');
    if (!pixCodeElement || !pixCodeElement.value) {
        alert('Código PIX não disponível');
        return;
    }

    pixCodeElement.select();
    pixCodeElement.setSelectionRange(0, 99999);

    try {
        const successful = document.execCommand('copy');
        if (successful) {
            const copyButton = document.querySelector('button[onclick="copyPixCode()"]');
            const originalText = copyButton.textContent;
            copyButton.textContent = '✓ Copiado!';
            copyButton.classList.remove('bg-green-500', 'hover:bg-green-600');
            copyButton.classList.add('bg-green-600');

            // Feedback visual adicional
            copyButton.style.transform = 'scale(0.95)';
            setTimeout(() => {
                copyButton.style.transform = '';
            }, 200);

            setTimeout(() => {
                copyButton.textContent = originalText;
                copyButton.classList.remove('bg-green-600');
                copyButton.classList.add('bg-green-500', 'hover:bg-green-600');
            }, 2000);
        }
    } catch (err) {
        // Fallback para Clipboard API moderna
        navigator.clipboard.writeText(pixCodeElement.value)
            .then(() => {
                alert('Código PIX copiado para a área de transferência!');
            })
            .catch(() => {
                alert('Selecione e copie o código manualmente (Ctrl+C)');
            });
    }
}

// checkar se o pix foi pago e retornar mensagem se sucesso

async function checkPayment(transactionId) {
    const url = `https://api-node-teal-nine.vercel.app/checkPayment/${transactionId}`
    try {
        console.log(`📡 verificando pagamento para a transação ${transactionId}`);

        const response = await fetch(url, {
            method: "GET",
            headers: {
                'Accept': 'application/json'
            }
        })
        if (!response.ok) {
            throw new Error(`Erro na API: ${response.status}`);
        }


        const data = await response.json();

        console.log(`📊 status do pagamento ${data}`);

        return {
            status: data.status || 'paid',
            ok: data.ok || true,
            transaction_id: transactionId,
            ...data
        }
    } catch (error) {
        console.error('❌ Erro ao verificar pagamento:', error);
        // Erro é esperado quando ainda não está pago
        return {
            status: 'waiting_payment',
            ok: false,
            transaction_id: transactionId,
            message: 'Ainda aguardando confirmação do pagamento'
        };
    }
}

// funçao principal de verificação de pagamento

// Função principal de verificação - AJUSTADA
function startPaymentVerification(transactionId, amount) {
    currentTransactionId = transactionId;
    paymentCheckAttempts = 0;
    
    console.log(`🚀 Iniciando verificação para transação: ${transactionId}`);
    
    // Mostra o status inicial
    showPaymentStatus(true, 'waiting_payment');
    
    // Inicia o intervalo de verificação
    paymentCheckInterval = setInterval(async () => {
        if (paymentCheckAttempts >= MAX_PAYMENT_CHECKS) {
            console.log('⏰ Tempo máximo de verificação atingido');
            stopPaymentVerification();
            showPaymentTimeout();
            return;
        }
        
        paymentCheckAttempts++;
        console.log(`🔄 Tentativa ${paymentCheckAttempts}/${MAX_PAYMENT_CHECKS}`);
        
        const result = await checkPayment(transactionId);
        
        // Verifica se o pagamento foi confirmado
        if (result.status === 'paid' && result.ok === true) {
            console.log('🎉🎉🎉 PAGAMENTO CONFIRMADO COM SUCESSO!');
            trackPurchase(amount)
            // Feedback visual imediato
            showPaymentConfirmedVisual();
            
            // Delay para o usuário ver a confirmação
            setTimeout(() => {
                stopPaymentVerification();
                showThankYouModal(amount, transactionId, result);
            }, 1500);
            
            return;
        }
        
        // Se ainda estiver aguardando
        console.log(`⏳ Status atual: ${result.status}`);
        updatePaymentStatus(paymentCheckAttempts, result.status);
        
    }, PAYMENT_CHECK_INTERVAL);

    // Mostrar status de pagamento - SIMPLIFICADA
function showPaymentStatus(show = true, status = 'waiting_payment') {
    const paymentStatus = document.getElementById('paymentStatus');
    if (!paymentStatus) return;
    
    if (show) {
        paymentStatus.classList.remove('hidden');
        
        const statusHtml = `
            <div class="flex items-center gap-3 text-blue-600">
                <div class="text-xl animate-pulse">⏳</div>
                <div class="text-left">
                    <span class="text-sm font-medium">Aguardando seu pagamento...</span>
                    <p class="text-xs text-gray-500">Não feche esta janela</p>
                </div>
            </div>
        `;
        
        paymentStatus.innerHTML = statusHtml;
    } else {
        paymentStatus.classList.add('hidden');
    }
}

// Atualizar status com barra de progresso
function updatePaymentStatus(attempt, status = 'waiting_payment') {
    const paymentStatus = document.getElementById('paymentStatus');
    if (!paymentStatus) return;
    
    const totalTime = MAX_PAYMENT_CHECKS * 5; // tempo total em segundos
    const elapsedTime = attempt * 5;
    const minutes = Math.floor(elapsedTime / 60);
    const seconds = elapsedTime % 60;
    const percent = Math.min((attempt / MAX_PAYMENT_CHECKS) * 100, 100);
    
    let statusMessage = 'Aguardando confirmação do pagamento...';
    
    // Mensagem motivacional baseada no tempo
    if (attempt > MAX_PAYMENT_CHECKS / 2) {
        statusMessage = 'Ainda aguardando... Obrigado pela paciência!';
    }
    
    const statusHtml = `
        <div class="space-y-2">
            <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                    <div class="text-blue-600">⏳</div>
                    <span class="text-sm font-medium">${statusMessage}</span>
                </div>
                <span class="text-xs text-gray-500">${minutes}:${seconds.toString().padStart(2, '0')}</span>
            </div>
            
            <!-- Barra de progresso -->
            <div class="w-full bg-gray-200 rounded-full h-2">
                <div class="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                     style="width: ${percent}%"></div>
            </div>
            
            <!-- Dica para o usuário -->
            <p class="text-xs text-gray-500 italic">
                💡 Já fez o pagamento? Às vezes a confirmação pode levar alguns minutos.
            </p>
        </div>
    `;
    
    paymentStatus.innerHTML = statusHtml;
}

// Mostrar quando o tempo expirar
function showPaymentTimeout() {
    const paymentStatus = document.getElementById('paymentStatus');
    if (!paymentStatus) return;
    
    paymentStatus.innerHTML = `
        <div class="space-y-3">
            <div class="flex items-center gap-2 text-yellow-600">
                <div class="text-xl">⏰</div>
                <div>
                    <span class="text-sm font-medium">Tempo de espera esgotado</span>
                    <p class="text-xs text-gray-500">Não recebemos confirmação do pagamento</p>
                </div>
            </div>
            
            <div class="text-xs text-gray-600 space-y-1">
                <p>Isso pode acontecer se:</p>
                <ul class="list-disc pl-4">
                    <li>O pagamento ainda está processando no seu banco</li>
                    <li>O código PIX expirou (1 hora)</li>
                    <li>Houve um erro na transação</li>
                </ul>
            </div>
            
            <div class="flex gap-2">
                <button onclick="regeneratePix()" 
                        class="flex-1 bg-green-500 hover:bg-green-600 text-white py-2 rounded-lg font-medium text-sm transition-colors">
                    Gerar novo PIX
                </button>
                <button onclick="closePixModal()" 
                        class="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 py-2 rounded-lg font-medium text-sm transition-colors">
                    Fechar
                </button>
            </div>
        </div>
    `;
}
}


// Mostrar status de pagamento - SIMPLIFICADA
function showPaymentStatus(show = true, status = 'waiting_payment') {
    const paymentStatus = document.getElementById('paymentStatus');
    if (!paymentStatus) return;
    
    if (show) {
        paymentStatus.classList.remove('hidden');
        
        const statusHtml = `
            <div class="flex items-center gap-3 text-blue-600">
                <div class="text-xl animate-pulse">⏳</div>
                <div class="text-left">
                    <span class="text-sm font-medium">Aguardando seu pagamento...</span>
                    <p class="text-xs text-gray-500">Não feche esta janela</p>
                </div>
            </div>
        `;
        
        paymentStatus.innerHTML = statusHtml;
    } else {
        paymentStatus.classList.add('hidden');
    }
}

// Atualizar status com barra de progresso
function updatePaymentStatus(attempt, status = 'waiting_payment') {
    const paymentStatus = document.getElementById('paymentStatus');
    if (!paymentStatus) return;
    
    const totalTime = MAX_PAYMENT_CHECKS * 5; // tempo total em segundos
    const elapsedTime = attempt * 5;
    const minutes = Math.floor(elapsedTime / 60);
    const seconds = elapsedTime % 60;
    const percent = Math.min((attempt / MAX_PAYMENT_CHECKS) * 100, 100);
    
    let statusMessage = 'Aguardando confirmação do pagamento...';
    
    // Mensagem motivacional baseada no tempo
    if (attempt > MAX_PAYMENT_CHECKS / 2) {
        statusMessage = 'Ainda aguardando... Obrigado pela paciência!';
    }
    
    const statusHtml = `
        <div class="space-y-2">
            <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                    <div class="text-blue-600">⏳</div>
                    <span class="text-sm font-medium">${statusMessage}</span>
                </div>
                <span class="text-xs text-gray-500">${minutes}:${seconds.toString().padStart(2, '0')}</span>
            </div>
            
            <!-- Barra de progresso -->
            <div class="w-full bg-gray-200 rounded-full h-2">
                <div class="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                     style="width: ${percent}%"></div>
            </div>
            
            <!-- Dica para o usuário -->
            <p class="text-xs text-gray-500 italic">
                💡 Já fez o pagamento? Às vezes a confirmação pode levar alguns minutos.
            </p>
        </div>
    `;
    
    paymentStatus.innerHTML = statusHtml;
}

// Mostrar quando o tempo expirar
function showPaymentTimeout() {
    const paymentStatus = document.getElementById('paymentStatus');
    if (!paymentStatus) return;
    
    paymentStatus.innerHTML = `
        <div class="space-y-3">
            <div class="flex items-center gap-2 text-yellow-600">
                <div class="text-xl">⏰</div>
                <div>
                    <span class="text-sm font-medium">Tempo de espera esgotado</span>
                    <p class="text-xs text-gray-500">Não recebemos confirmação do pagamento</p>
                </div>
            </div>
            
            <div class="text-xs text-gray-600 space-y-1">
                <p>Isso pode acontecer se:</p>
                <ul class="list-disc pl-4">
                    <li>O pagamento ainda está processando no seu banco</li>
                    <li>O código PIX expirou (1 hora)</li>
                    <li>Houve um erro na transação</li>
                </ul>
            </div>
            
            <div class="flex gap-2">
                <button onclick="regeneratePix()" 
                        class="flex-1 bg-green-500 hover:bg-green-600 text-white py-2 rounded-lg font-medium text-sm transition-colors">
                    Gerar novo PIX
                </button>
                <button onclick="closePixModal()" 
                        class="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 py-2 rounded-lg font-medium text-sm transition-colors">
                    Fechar
                </button>
            </div>
        </div>
    `;
}