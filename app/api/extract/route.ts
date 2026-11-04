import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { PDFDocument } from '@cantoo/pdf-lib';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Chave GEMINI_API_KEY não configurada no arquivo .env.local ou na Vercel' },
        { status: 400 }
      );
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const cardName = (formData.get('cardName') as string) || '';
    const password = (formData.get('password') as string) || '';

    if (!file) {
      return NextResponse.json({ error: 'Nenhum arquivo enviado.' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    let base64Data = Buffer.from(arrayBuffer).toString('base64');
    let mimeType = file.type || 'application/pdf';

    // 1. Desbloqueio seguro de PDF com senha via @cantoo/pdf-lib
    if (file.name.toLowerCase().endsWith('.pdf') || mimeType.includes('pdf')) {
      try {
        const pdfDoc = await PDFDocument.load(arrayBuffer, {
          password: password.trim() || undefined,
        });
        const unencryptedBytes = await pdfDoc.save();
        base64Data = Buffer.from(unencryptedBytes).toString('base64');
        mimeType = 'application/pdf';
      } catch (pdfErr: any) {
        const errMsg = String(pdfErr?.message || '');
        if (
          errMsg.includes('password') ||
          errMsg.includes('encrypted') ||
          errMsg.includes('Password') ||
          errMsg.includes('Security') ||
          errMsg.includes('decrypt')
        ) {
          if (!password.trim()) {
            return NextResponse.json(
              { error: '🔒 Esta fatura está protegida por senha. Por favor, digite a senha da fatura (ex: dígitos do CPF ou data de nascimento) no campo "Senha da fatura" para abrir.' },
              { status: 422 }
            );
          } else {
            return NextResponse.json(
              { error: '❌ Senha incorreta para esta fatura. Verifique a senha do seu banco e tente novamente.' },
              { status: 422 }
            );
          }
        }
      }
    }

    const ai = new GoogleGenAI({ apiKey });

    const prompt = `Você é um especialista em conciliação de faturas de cartão de crédito brasileiras.
Analise detalhadamente ${cardName ? `a fatura do cartão "${cardName}"` : 'a fatura em anexo'}.
Extraia todas as compras e parcelas contidas na fatura.

Instruções críticas:
1. Para cada compra parcelada (ex: "LOJA X PARC 03/10" ou "03/10 LOJA X" ou "3/10"), identifique:
   - current_installment: o número da parcela cobrada nesta fatura (ex: 3)
   - total_installments: o total de parcelas (ex: 10)
   - Se for compra à vista (sem parcelamento), current_installment = 1 e total_installments = 1.
2. Identifique o valor exato da parcela (número decimal, ex: 154.90).
3. Identifique o valor total consolidado da fatura (total_amount).
4. Identifique o mês e ano de vencimento ou competência da fatura.

Retorne EXCLUSIVAMENTE um objeto JSON válido, sem crases de markdown e sem texto adicional:
{
  "card_name": "${cardName || 'Nome do cartão'}",
  "due_date": "YYYY-MM-DD",
  "month": 3,
  "year": 2026,
  "total_amount": 1250.50,
  "items": [
    {
      "date": "DD/MM/YYYY",
      "description": "NOME DO ESTABELECIMENTO",
      "current_installment": 1,
      "total_installments": 5,
      "amount": 150.00
    }
  ]
}`;

    const contents = [
      {
        inlineData: {
          data: base64Data,
          mimeType: mimeType || 'application/pdf',
        },
      },
      prompt,
    ];

    // Lista de modelos resilientes
    const CANDIDATE_MODELS = ['gemini-3.5-flash', 'gemini-3.8-flash', 'gemini-3.7-flash'];
    let response: any = null;
    let lastApiError: any = null;

    for (const modelName of CANDIDATE_MODELS) {
      try {
        response = await ai.models.generateContent({
          model: modelName,
          contents,
          config: {
            responseMimeType: 'application/json',
          },
        });
        if (response) break;
      } catch (err: any) {
        lastApiError = err;
        const msg = String(err?.message || '');
        if (msg.includes('503') || msg.includes('404') || msg.includes('UNAVAILABLE') || msg.includes('demand')) {
          console.warn(`Modelo ${modelName} temporariamente indisponível, tentando próximo...`);
          continue;
        }
        throw err;
      }
    }

    if (!response && lastApiError) {
      throw lastApiError;
    }

    const responseText = response?.text || '{}';
    const parsed = JSON.parse(responseText);

    return NextResponse.json({ success: true, data: parsed });
  } catch (error: any) {
    console.error('Erro na extração com Gemini:', error);
    let userMsg = error?.message || 'Falha ao processar fatura com Gemini';
    if (userMsg.includes('INVALID_ARGUMENT') || userMsg.includes('400')) {
      userMsg = 'O PDF não pôde ser lido (possivelmente protegido por senha). Digite a senha no campo "Senha da fatura" e tente novamente.';
    } else if (userMsg.includes('503') || userMsg.includes('UNAVAILABLE') || userMsg.includes('demand')) {
      userMsg = 'Alta demanda temporária nos servidores de IA. Por favor, aguarde alguns segundos e clique em Processar novamente.';
    }
    return NextResponse.json(
      { error: userMsg },
      { status: 400 }
    );
  }
}
