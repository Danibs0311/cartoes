import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Chave GEMINI_API_KEY não configurada no arquivo .env.local' },
        { status: 400 }
      );
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const cardName = (formData.get('cardName') as string) || '';

    if (!file) {
      return NextResponse.json({ error: 'Nenhum arquivo enviado.' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const base64Data = Buffer.from(arrayBuffer).toString('base64');
    const mimeType = file.type || 'application/pdf';

    const ai = new GoogleGenAI({ apiKey });

    const prompt = `Você é um especialista em extração e conciliação de faturas de cartão de crédito brasileiras.
Analise detalhadamente o arquivo de fatura em anexo ${cardName ? `referente ao cartão "${cardName}"` : ''}.
Extraia todas as compras e parcelas contidas na fatura.

Instruções críticas:
1. Para cada compra parcelada (ex: "LOJA X PARC 03/10" ou "03/10 LOJA X" ou "3/10"), identifique com precisão:
   - current_installment: o número da parcela cobrada nesta fatura (ex: 3)
   - total_installments: o total de parcelas (ex: 10)
   - Se for compra à vista (sem parcelamento), current_installment = 1 e total_installments = 1.
2. Identifique o valor exato da parcela (número decimal, ex: 154.90).
3. Identifique o valor total consolidado da fatura (total_amount).
4. Identifique o mês e ano de vencimento ou competência da fatura.

Retorne EXCLUSIVAMENTE um objeto JSON válido, sem crases de markdown e sem texto adicional:
{
  "card_name": "Nome do cartão ou banco identificado",
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

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-pro',
      contents: [
        {
          role: 'user',
          parts: [
            {
              inlineData: {
                data: base64Data,
                mimeType: mimeType,
              },
            },
            {
              text: prompt,
            },
          ],
        },
      ],
      config: {
        responseMimeType: 'application/json',
      },
    });

    const responseText = response.text || '{}';
    const parsed = JSON.parse(responseText);

    return NextResponse.json({ success: true, data: parsed });
  } catch (error: any) {
    console.error('Erro na extração com Gemini:', error);
    return NextResponse.json(
      { error: error?.message || 'Falha ao processar fatura com Gemini' },
      { status: 500 }
    );
  }
}
