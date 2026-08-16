import React, { useState, useRef } from 'react';
import { 
  Modal, 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  Platform, 
  KeyboardAvoidingView, 
  ScrollView,
  ActivityIndicator,
  Animated
} from 'react-native';

const MODERN_FONT = Platform.OS === 'web' ? '"Inter", "Segoe UI", Roboto, Helvetica, Arial, sans-serif' : 'System';

// ============================================================================
// DICIONÁRIO APRIMORADO DE SINÔNIMOS E PERGUNTAS DE FORMULÁRIOS
// ============================================================================
const DICTIONARY = {
  name: [
    'nome', 'cliente', 'lead', 'full name', 'nome completo', 'razao social', 
    'primeiro nome', 'sobrenome', 'nome do contato', 'como se chama', 'qual o seu nome'
  ],
  phone: [
    'telefone', 'whatsapp', 'celular', 'whats', 'wpp', 'zap', 'fone', 'contato', 
    'numero', 'mobile', 'phone', 'ligar', 'telefone para contato', 'qual o seu telefone', 
    'qual o seu whatsapp', 'numero de whatsapp'
  ],
  email: [
    'email', 'e-mail', 'correio eletronico', 'endereço de email', 
    'qual o seu email', 'qual o seu e-mail'
  ],
  cpf: [
    'cpf', 'cnpj', 'documento', 'identidade', 'rg', 'doc'
  ],
  profession: [
    'profissao', 'profissão', 'trabalho', 'cargo', 'ocupacao', 'ocupação', 'o que faz', 
    'onde trabalha', 'ramo de atuaçao', 'area de atuacao', 'trabalha com o que', 'emprego', 
    'qual a sua profissao', 'qual a sua profissão', 'sua profissão', 'sua profissao'
  ],
  monthlyIncome: [
    'renda', 'salario', 'salário', 'faturamento', 'ganho', 'receita', 'ganhos', 
    'quanto ganha', 'rendimento', 'renda mensal', 'renda familiar', 'rendimento mensal', 
    'faturamento mensal', 'qual a sua renda', 'sua renda', 'renda aproximada'
  ],
  category: [
    'categoria', 'qual bem', 'tipo de bem', 'o que deseja', 'interesse', 'tipo de consorcio', 
    'tipo de consórcio', 'o que busca', 'automovel', 'automóvel', 'imovel', 'imóvel', 
    'veiculo', 'veículo', 'serviço', 'servico', 'produto', 'qual o seu objetivo', 
    'qual bem deseja', 'qual tipo de consorcio', 'qual tipo de consórcio', 
    'procura fazer um consorcio para qual bem', 'qual o bem', 'consórcio para qual bem', 
    'consorcio para qual bem', 'para qual bem', 'qual bem esta em busca'
  ],
  desiredCredit: [
    'valor do bem', 'credito', 'crédito', 'carta', 'meta', 'qual valor', 'de quanto precisa', 
    'capital', 'valor da carta', 'valor desejado', 'valor do credito', 'valor do crédito', 
    'valor do imovel', 'valor do veiculo', 'montante', 'valor que esta em busca', 
    'qual valor do bem', 'qual o valor pretendido', 'valor pretendido', 
    'de quanto é a carta', 'qual o valor', 'valor do automovel'
  ],
  idealInstallment: [
    'parcela', 'mensalidade', 'media de parcela', 'média de parcela', 'pagamento', 
    'quanto pode pagar', 'parcela ideal', 'disponibilidade mensal', 'valor da parcela', 
    'parcela maxima', 'parcela máxima', 'capadidade de pagamento', 'qual a parcela', 
    'qual valor de parcela', 'qual o valor da parcela', 'parcela que cabe no bolso', 
    'quanto pretende pagar', 'quanto pretende pagar por mes'
  ],
  urgency: [
    'urgencia', 'urgência', 'prazo', 'quando', 'em qual momento', 'tempo', 'para quando', 
    'expectativa', 'quando pretende', 'imediatismo', 'momento de compra', 
    'qual o seu prazo', 'em quanto tempo', 'momento esta em relacao'
  ],
  bidAmount: [
    'lance', 'valor para lance', 'ofertar lance', 'entrada', 'valor disponivel', 
    'valor disponível', 'reserva financeira', 'tem valor para lance', 'valor de entrada', 
    'montante para lance', 'possui valor para lance', 'possui lance', 'tem lance', 
    'qual o valor do lance', 'quanto tem de lance', 'valor guardado', 'dinheiro guardado'
  ],
  bidType: [
    'tipo de lance', 'recurso', 'fgts', 'embutido', 'livre', 'lance fixo', 'lance livre', 
    'recurso proprio', 'como pretende ofertar o lance', 'qual tipo de lance', 'vai usar fgts'
  ],
  hasFinancing: [
    'financiamento', 'financiado', 'possui financiamento', 'paga juros', 'tem financiamento', 
    'ja tem proposta', 'já tem proposta', 'ja fez consorcio', 'já fez consórcio', 
    'ja tem consorcio', 'já tem consorcio', 'tem proposta de consorcio ou financiamento'
  ],
  platform: [
    'plataforma', 'origem', 'fonte', 'campanha', 'anuncio', 'anúncio', 'source', 'adset', 
    'utm_source', 'veio de onde', 'form', 'formulario', 'formulário', 'publico', 'público', 'criativo'
  ],
  consorcioKnowledge: [
    'voce conhece o consorcio', 'conhece o consorcio', 'ja teve consorcio', 'sabe como funciona'
  ],
  reason: [
    'por que esta preenchendo', 'motivo', 'por que preencheu', 'por que preenchendo'
  ]
};

const sortedDictionaryEntries = Object.entries(DICTIONARY).map(([field, synonyms]) => {
  return [field, [...synonyms].sort((a, b) => b.length - a.length)];
});

// ============================================================================
// FUNÇÕES UTILITÁRIAS DE TRATAMENTO
// ============================================================================
const normalizeString = (str) => {
  if (!str) return '';
  return String(str)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[_]/g, " ") 
    .replace(/[^a-z0-9 ]/g, "")
    .trim();
};

const identifyField = (line) => {
  if (!line) return null;
  const normLine = normalizeString(line);
  if (normLine.length < 2) return null;

  // 1. Busca Exata
  for (const [field, synonyms] of sortedDictionaryEntries) {
    if (synonyms.some(s => normLine === normalizeString(s))) return field;
  }

  // 2. Busca de Início (Label-like)
  for (const [field, synonyms] of sortedDictionaryEntries) {
    if (synonyms.some(s => normLine.startsWith(normalizeString(s)))) return field;
  }

  // 3. Busca por Contenção (Somente para linhas curtas ou perguntas diretas para evitar falsos positivos)
  if (normLine.length < 60 || line.trim().endsWith('?')) {
    for (const [field, synonyms] of sortedDictionaryEntries) {
      if (synonyms.some(s => {
        const normSyn = normalizeString(s);
        return normSyn.length > 4 && normLine.includes(normSyn);
      })) {
        return field;
      }
    }
  }
  return null;
};

const parseCategoryValue = (rawValue, fullBlockText = '') => {
  const combinedText = normalizeString(`${rawValue || ''} ${fullBlockText}`);
  if (combinedText.includes('auto') || combinedText.includes('carro') || combinedText.includes('veiculo') || combinedText.includes('automovel') || combinedText.includes('picape') || combinedText.includes('motocicleta') || combinedText.includes('moto')) return 'Auto';
  if (combinedText.includes('imovel') || combinedText.includes('casa') || combinedText.includes('fazenda') || combinedText.includes('sitio') || combinedText.includes('apartamento') || combinedText.includes('terreno')) return 'Imóvel';
  if (combinedText.includes('pesado') || combinedText.includes('caminhao') || combinedText.includes('maquina') || combinedText.includes('carreta') || combinedText.includes('trator')) return 'Pesados';
  if (combinedText.includes('servico')) return 'Serviços';
  if (combinedText.includes('invest') || combinedText.includes('investimento') || combinedText.includes('investir') || combinedText.includes('extruturado') || combinedText.includes('estruturado') || combinedText.includes('poupanca')) return 'Investimento';
  return rawValue ? String(rawValue).trim() : '';
};

const formatPhoneNumber = (phone) => {
  if (!phone) return '';
  let cleaned = String(phone).replace(/\D/g, '');
  if (!cleaned.startsWith('55') && cleaned.length >= 10 && cleaned.length <= 11) cleaned = '55' + cleaned;
  const match = cleaned.match(/^(\d{2})(\d{2})(\d{4,5})(\d{4})$/);
  if (match) return `+${match[1]} (${match[2]}) ${match[3]}-${match[4]}`;
  return String(phone);
};

const normalizePlatform = (rawPlatform) => {
  if (!rawPlatform) return 'Desconhecida';
  const platform = String(rawPlatform).toLowerCase();
  if (platform.includes('ig') || platform.includes('insta')) return 'Instagram';
  if (platform.includes('fb') || platform.includes('face')) return 'Facebook';
  if (platform.includes('goo') || platform.includes('ads')) return 'Google';
  if (platform.includes('tik') || platform.includes('tok')) return 'TikTok';
  return String(rawPlatform).trim();
};

export default function ImportLeadsModal({ visible, onClose, onImport, isDarkMode }) {
  const [rawText, setRawText] = useState('');
  const [processing, setProcessing] = useState(false);
  const [removeFormatting, setRemoveFormatting] = useState(true);

  const [alertConfig, setAlertConfig] = useState({ visible: false, type: 'success', title: '', message: '' });
  const alertScale = useRef(new Animated.Value(0.8)).current;
  const alertOpacity = useRef(new Animated.Value(0)).current;

  const showCustomAlert = (type, title, message) => {
    setAlertConfig({ visible: true, type, title, message });
    alertScale.setValue(0.8);
    alertOpacity.setValue(0);
    Animated.parallel([
      Animated.spring(alertScale, { toValue: 1, friction: 6, useNativeDriver: Platform.OS !== 'web' }),
      Animated.timing(alertOpacity, { toValue: 1, duration: 250, useNativeDriver: Platform.OS !== 'web' })
    ]).start();
  };

  const closeCustomAlert = (callback) => {
    Animated.parallel([
      Animated.timing(alertScale, { toValue: 0.8, duration: 200, useNativeDriver: Platform.OS !== 'web' }),
      Animated.timing(alertOpacity, { toValue: 0, duration: 200, useNativeDriver: Platform.OS !== 'web' })
    ]).start(() => {
      setAlertConfig({ visible: false, type: 'success', title: '', message: '' });
      if (typeof callback === 'function') callback();
    });
  };

  // ============================================================================
  // MOTOR DE LEITURA (MÁQUINA DE ESTADOS RECONSTRUÍDA)
  // ============================================================================
  const processLeadsIntelligence = (text) => {
    let textToProcess = String(text);
    
    if (removeFormatting) {
      textToProcess = textToProcess.replace(/[*~`]/g, '');
      textToProcess = textToProcess.replace(/_/g, ' ');
    }

    let blocks = [];
    const leadSeparatorRegex = /(?=✅?\s*\*?NOVO LEAD|={3,}|-{3,})/gi;
    if (leadSeparatorRegex.test(textToProcess)) blocks = textToProcess.split(leadSeparatorRegex);
    else blocks = [textToProcess];

    const extractedClients = [];

    blocks.forEach(block => {
      const lines = block.split('\n').map(l => l.trim()).filter(l => l.length > 0);
      if (lines.length < 2) return;

      const leadData = {};
      const unmappedData = [];
      let activeField = null; // A "Máquina de Estado" começa nula

      lines.forEach(line => {
        // Ignora blocos estruturais desnecessários
        if (/(respostas do.? lead|clique no n.mero|clique no numero)/i.test(line)) return;
        if (/(novo lead gerado|novo lead|campanha:)/i.test(line) && !line.includes(':')) return;

        let keyPart = null;
        let valPart = null;

        // Tenta capturar "Chave: Valor" de forma segura (Preferência por 2 pontos)
        const colonMatch = line.match(/^([^:]+):(.*)$/);
        if (colonMatch) {
          keyPart = colonMatch[1].trim();
          valPart = colonMatch[2].trim();
        } else {
          // Fallback para separação com hífen e espaços (para não quebrar emails como joao-silva@mail.com)
          const hyphenMatch = line.match(/^([^-]+)\s+-\s+(.*)$/);
          if (hyphenMatch) {
            keyPart = hyphenMatch[1].trim();
            valPart = hyphenMatch[2].trim();
          }
        }

        if (keyPart !== null) {
          const field = identifyField(keyPart);
          if (field) {
            if (valPart.length > 0) {
              if (field === 'platform' && leadData[field]) {
                leadData[field] += ` | ${valPart}`;
              } else {
                leadData[field] = valPart;
              }
              activeField = null; // Valor já consumido
            } else {
              activeField = field; // Aguarda o valor na próxima linha
            }
            return;
          }
        }

        // Não é "Chave: Valor". É uma Label ou Pergunta Conhecida?
        const field = identifyField(line);
        if (field) {
          activeField = field;
          return;
        }

        // É um valor puro, atribuímos ao Estado Atual Ativo!
        if (activeField) {
          if (leadData[activeField]) {
            leadData[activeField] += ` ${line}`;
          } else {
            leadData[activeField] = line;
          }
          // Mantém activeField aberto, a próxima linha pode ser continuação da resposta.
          return;
        }

        // Sem Estado Ativo? É dado não mapeado.
        unmappedData.push(line);
      });

      // Validação do Lead
      const rawPhoneDigits = String(leadData.phone || '').replace(/\D/g, '');
      const hasValidPhone = rawPhoneDigits.length >= 8;

      if ((leadData.name || leadData.phone) && hasValidPhone) {
        const initialInfoLines = [];
        const resolvedCategory = parseCategoryValue(leadData.category, block);

        if (leadData.desiredCredit) initialInfoLines.push(`Meta/Crédito: ${leadData.desiredCredit}`);
        if (leadData.idealInstallment) initialInfoLines.push(`Parcela Ideal: ${leadData.idealInstallment}`);
        if (leadData.urgency) initialInfoLines.push(`Urgência: ${leadData.urgency}`);
        if (leadData.bidAmount) initialInfoLines.push(`Lance: ${leadData.bidAmount}`);
        if (leadData.bidType) initialInfoLines.push(`Tipo de Lance: ${leadData.bidType}`);
        if (leadData.hasFinancing) initialInfoLines.push(`Financiamento Ativo: ${leadData.hasFinancing}`);
        if (leadData.consorcioKnowledge) initialInfoLines.push(`Conhece Consórcio: ${leadData.consorcioKnowledge}`);
        if (leadData.reason) initialInfoLines.push(`Motivo de Preenchimento: ${leadData.reason}`);

        if (unmappedData.length > 0) {
          const cleanedUnmapped = unmappedData.filter(u => u.length > 2).join('\n');
          if (cleanedUnmapped.trim()) initialInfoLines.push(`\nInformações:\n${cleanedUnmapped}`);
        }

        extractedClients.push({
          id: `client_imp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
          createdAt: new Date().toISOString(),
          name: String(leadData.name || 'Lead Não Identificado').trim(),
          phone: formatPhoneNumber(String(leadData.phone || '')),
          email: String(leadData.email || '').trim(),
          cpf: String(leadData.cpf || '').trim(),
          profession: String(leadData.profession || '').trim(),
          monthlyIncome: String(leadData.monthlyIncome || '').trim(),
          category: String(resolvedCategory || '').trim(),
          desiredCredit: String(leadData.desiredCredit || '').trim(),
          idealInstallment: String(leadData.idealInstallment || '').trim(),
          urgency: String(leadData.urgency || '').trim(),
          bidAmount: String(leadData.bidAmount || '').trim(),
          bidType: String(leadData.bidType || '').trim(),
          hasFinancing: String(leadData.hasFinancing || '').trim(),
          platform: normalizePlatform(String(leadData.platform || '')),
          leadTemp: 'Morno',
          winProbability: '',
          initialInfo: String(initialInfoLines.join('\n')).trim(),
          history: `DADOS BRUTOS ORIGINAIS:\n${block}`
        });
      }
    });

    return extractedClients;
  };

  const handleProcessText = () => {
    if (!rawText.trim()) {
      showCustomAlert('error', 'Atenção', 'Por favor, cole os dados dos leads na área de texto antes de prosseguir.');
      return;
    }
    
    setProcessing(true);

    setTimeout(() => {
      try {
        const newClients = processLeadsIntelligence(rawText);

        if (newClients.length === 0) {
          showCustomAlert('error', 'Falha na Análise', 'Nenhum lead válido foi encontrado. Lembre-se de que todos os leads precisam obrigatoriamente possuir um número de telefone.');
          setProcessing(false);
          return;
        }

        onImport(newClients);
        showCustomAlert('success', 'Importação Concluída', `${newClients.length} Lead(s) importado(s) e estruturado(s) com sucesso.`, () => {
          setRawText('');
          onClose();
        });

      } catch (error) {
        console.error("Erro Crítico no Motor de Importação:", error);
        showCustomAlert('error', 'Erro Interno', 'Ocorreu um erro ao processar a estrutura do texto.');
      } finally {
        setProcessing(false);
      }
    }, 300);
  };

  const themeStyles = isDarkMode ? darkStyles : lightStyles;

  return (
    <Modal animationType="fade" transparent={true} visible={visible} onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        
        {alertConfig.visible && (
          <View style={styles.successAlertOverlay}>
            <Animated.View style={[styles.successAlertBox, themeStyles.successAlertBox, { opacity: alertOpacity, transform: [{ scale: alertScale }] }]}>
              <Text style={styles.successAlertIcon}>{alertConfig.type === 'success' ? '✅' : '⚠️'}</Text>
              <Text style={[styles.successAlertTitle, themeStyles.successAlertTitle]}>{alertConfig.title}</Text>
              <Text style={[styles.successAlertMessage, themeStyles.successAlertMessage]}>{alertConfig.message}</Text>
              <TouchableOpacity 
                style={[styles.successAlertBtn, alertConfig.type === 'error' && { backgroundColor: '#ef4444' }]} 
                onPress={() => closeCustomAlert(alertConfig.type === 'success' ? alertConfig.onPress : null)}
              >
                <Text style={styles.successAlertBtnText}>{alertConfig.type === 'success' ? 'Continuar' : 'Entendi'}</Text>
              </TouchableOpacity>
            </Animated.View>
          </View>
        )}

        <View style={[styles.modalContainer, themeStyles.modalContainer]}>
          <View style={[styles.header, themeStyles.header]}>
            <View>
              <Text style={[styles.title, themeStyles.title]}>Importação de Leads em Massa</Text>
              <Text style={[styles.subtitle, themeStyles.subtitle]}>O motor lerá perguntas e respostas ou formatos estruturados automaticamente.</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={[styles.closeButton, themeStyles.closeButton]}>
              <Text style={[styles.closeButtonText, themeStyles.closeButtonText]}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            <View style={styles.toolsRow}>
              <Text style={[styles.inputLabel, themeStyles.inputLabel]}>Dados Brutos da Campanha</Text>
              <TouchableOpacity style={[styles.compactToggle, themeStyles.compactToggle]} activeOpacity={0.7} onPress={() => setRemoveFormatting(!removeFormatting)}>
                <View style={[styles.compactCheckbox, themeStyles.compactCheckbox, removeFormatting && styles.compactCheckboxChecked]}>
                  {removeFormatting && <Text style={styles.compactCheckmark}>✓</Text>}
                </View>
                <Text style={[styles.compactToggleText, themeStyles.compactToggleText]}>Limpar formatação (* e _)</Text>
              </TouchableOpacity>
            </View>

            <TextInput
              style={[styles.textArea, themeStyles.textArea]}
              multiline={true}
              placeholder="Cole os dados aqui...&#10;&#10;O sistema identifica formatos em linha:&#10;Nome: João Silva&#10;Telefone: 85999999999&#10;&#10;E também formatos de formulários (Pular linha):&#10;Qual o valor do bem desejado?&#10;R$ 150.000,00"
              placeholderTextColor={isDarkMode ? '#64748b' : '#94a3b8'}
              value={rawText}
              onChangeText={setRawText}
            />
          </ScrollView>

          <View style={[styles.footer, themeStyles.footer]}>
            <TouchableOpacity style={[styles.cancelButton, themeStyles.cancelButton]} onPress={onClose} disabled={processing}>
              <Text style={[styles.cancelButtonText, themeStyles.cancelButtonText]}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.saveButton} onPress={handleProcessText} disabled={processing}>
              {processing ? (
                <View style={styles.processingBtnRow}>
                  <ActivityIndicator size="small" color="#ffffff" style={{ marginRight: 8 }} />
                  <Text style={styles.saveButtonText}>Processando Dados...</Text>
                </View>
              ) : (
                <Text style={styles.saveButtonText}>Processar e Importar</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.65)', justifyContent: 'center', alignItems: 'center', padding: 16 },
  modalContainer: { width: '100%', maxWidth: 750, borderRadius: 16, maxHeight: '90%', overflow: 'hidden', ...Platform.select({ web: { outlineStyle: 'none', boxShadow: '0px 20px 40px rgba(0,0,0,0.15)' } }) },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 24, borderBottomWidth: 1 },
  title: { fontFamily: MODERN_FONT, fontSize: 20, fontWeight: '800', letterSpacing: -0.5 },
  subtitle: { fontFamily: MODERN_FONT, fontSize: 13, marginTop: 4 },
  closeButton: { width: 32, height: 32, borderRadius: 8, justifyContent: 'center', alignItems: 'center', borderWidth: 1 },
  closeButtonText: { fontFamily: MODERN_FONT, fontSize: 14, fontWeight: 'bold' },
  scrollContent: { padding: 24 },
  toolsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 10 },
  inputLabel: { fontFamily: MODERN_FONT, fontSize: 14, fontWeight: '700' },
  compactToggle: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, paddingHorizontal: 10, borderRadius: 6, borderWidth: 1 },
  compactCheckbox: { width: 16, height: 16, borderRadius: 4, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', marginRight: 8 },
  compactCheckboxChecked: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  compactCheckmark: { color: '#ffffff', fontSize: 10, fontWeight: '900' },
  compactToggleText: { fontFamily: MODERN_FONT, fontSize: 12, fontWeight: '600' },
  textArea: { height: 380, borderWidth: 1, borderRadius: 12, padding: 16, fontSize: 13, fontFamily: MODERN_FONT, textAlignVertical: 'top', lineHeight: 22, ...Platform.select({ web: { outlineStyle: 'none' } }) },
  footer: { flexDirection: 'row', padding: 20, borderTopWidth: 1, justifyContent: 'flex-end', gap: 12 },
  cancelButton: { paddingVertical: 12, paddingHorizontal: 24, alignItems: 'center', borderRadius: 8 },
  cancelButtonText: { fontFamily: MODERN_FONT, fontWeight: '700', fontSize: 14 },
  saveButton: { paddingVertical: 12, paddingHorizontal: 28, alignItems: 'center', borderRadius: 8, backgroundColor: '#2563eb', ...Platform.select({ web: { boxShadow: '0px 4px 10px rgba(37, 99, 235, 0.2)' } }) },
  processingBtnRow: { flexDirection: 'row', alignItems: 'center' },
  saveButtonText: { fontFamily: MODERN_FONT, color: '#ffffff', fontWeight: '700', fontSize: 14 },
  successAlertOverlay: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(15, 23, 42, 0.4)', justifyContent: 'center', alignItems: 'center', zIndex: 9999 },
  successAlertBox: { padding: 24, borderRadius: 16, alignItems: 'center', width: 320, ...Platform.select({ web: { boxShadow: '0px 10px 25px rgba(0,0,0,0.2)' } }) },
  successAlertIcon: { fontSize: 48, marginBottom: 12 },
  successAlertTitle: { fontFamily: MODERN_FONT, fontSize: 20, fontWeight: '800', marginBottom: 8, textAlign: 'center' },
  successAlertMessage: { fontFamily: MODERN_FONT, fontSize: 14, textAlign: 'center', marginBottom: 24, lineHeight: 20 },
  successAlertBtn: { backgroundColor: '#10b981', paddingVertical: 12, borderRadius: 8, width: '100%', alignItems: 'center' },
  successAlertBtnText: { fontFamily: MODERN_FONT, color: '#ffffff', fontWeight: '700', fontSize: 14 }
});

const lightStyles = StyleSheet.create({
  modalContainer: { backgroundColor: '#ffffff' },
  header: { borderBottomColor: '#f1f5f9', backgroundColor: '#ffffff' },
  title: { color: '#0f172a' },
  subtitle: { color: '#64748b' },
  closeButton: { backgroundColor: '#f8fafc', borderColor: '#e2e8f0' },
  closeButtonText: { color: '#475569' },
  inputLabel: { color: '#1e293b' },
  compactToggle: { backgroundColor: '#f8fafc', borderColor: '#e2e8f0' },
  compactCheckbox: { borderColor: '#cbd5e1', backgroundColor: '#ffffff' },
  compactToggleText: { color: '#475569' },
  textArea: { backgroundColor: '#f8fafc', borderColor: '#e2e8f0', color: '#0f172a' },
  footer: { backgroundColor: '#ffffff', borderTopColor: '#f1f5f9' },
  cancelButton: { backgroundColor: '#f1f5f9' },
  cancelButtonText: { color: '#475569' },
  successAlertBox: { backgroundColor: '#ffffff' },
  successAlertTitle: { color: '#1e293b' },
  successAlertMessage: { color: '#475569' }
});

const darkStyles = StyleSheet.create({
  modalContainer: { backgroundColor: '#1e293b', borderColor: '#334155', borderWidth: 1 },
  header: { borderBottomColor: '#334155', backgroundColor: '#1e293b' },
  title: { color: '#f8fafc' },
  subtitle: { color: '#94a3b8' },
  closeButton: { backgroundColor: '#0f172a', borderColor: '#334155' },
  closeButtonText: { color: '#94a3b8' },
  inputLabel: { color: '#f8fafc' },
  compactToggle: { backgroundColor: '#0f172a', borderColor: '#334155' },
  compactCheckbox: { borderColor: '#334155', backgroundColor: '#0f172a' },
  compactToggleText: { color: '#94a3b8' },
  textArea: { backgroundColor: '#0f172a', borderColor: '#334155', color: '#f8fafc' },
  footer: { backgroundColor: '#1e293b', borderTopColor: '#334155' },
  cancelButton: { backgroundColor: '#0f172a', borderColor: '#334155', borderWidth: 1 },
  cancelButtonText: { color: '#cbd5e1' },
  successAlertBox: { backgroundColor: '#1e293b', borderColor: '#334155', borderWidth: 1 },
  successAlertTitle: { color: '#f8fafc' },
  successAlertMessage: { color: '#94a3b8' }
});