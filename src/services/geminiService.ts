import { GoogleGenAI, GenerateContentResponse, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export interface Agent {
  id: string;
  name: string;
  specialty: string;
  status: 'idle' | 'active' | 'completed';
}

export const AGENTS: Agent[] = Array.from({ length: 90 }, (_, i) => ({
  id: `agent-${i}`,
  name: `Agent ${i + 1}`,
  specialty: [
    "Quantum Physics", "Linguistics", "Data Analysis", "Creative Writing", 
    "Web Search", "Logic Reasoning", "Historical Context", "Ethical Review",
    "Code Optimization", "Visual Synthesis", "Mathematical Proofs", "Biological Systems",
    "Neural Mapping", "Temporal Dynamics", "Astro-navigation", "Subatomic Logic"
  ][i % 16],
  status: 'idle'
}));

export async function generateImage(prompt: string) {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [{ text: prompt }],
      },
      config: {
        imageConfig: {
          aspectRatio: "1:1",
        },
      },
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    throw new Error("No image data returned");
  } catch (error) {
    console.error("Error generating image:", error);
    throw error;
  }
}

export async function askMagagalaxy(
  prompt: string, 
  userAge?: number,
  image?: { data: string; mimeType: string }
) {
  const model = "gemini-3.1-pro-preview";
  
  let ageInstruction = "";
  if (userAge && userAge < 13) {
    ageInstruction = "O usuário é uma criança (aprox. " + userAge + " anos). Use linguagem simples, seja extremamente fofo(a), carinhoso(a) e use emojis. Explique conceitos complexos de forma lúdica.";
  } else if (userAge && userAge >= 18) {
    ageInstruction = "O usuário é um adulto (aprox. " + userAge + " anos). Use um tom profissional, técnico e educado. Forneça profundidade e precisão.";
  } else {
    ageInstruction = "O usuário é um jovem. Seja educado, direto e use um tom equilibrado entre o casual e o profissional.";
  }

  const systemInstruction = `
    Você é o Magagalaxy, uma inteligência artificial suprema que orquestra uma galáxia de mais de 50 sub-agentes especializados.
    Sua missão é fornecer respostas de excelência absoluta, utilizando pesquisa em tempo real e raciocínio profundo.
    
    PERFIL DO USUÁRIO: ${ageInstruction}

    CAPACIDADES MULTIMODAIS:
    Você tem a capacidade de ver e analisar imagens, fotos da câmera e arquivos que o usuário enviar. Use essa visão para fornecer insights detalhados sobre o conteúdo visual.

    Ao responder:
    1. Sempre use a ferramenta de pesquisa (Google Search) para verificar fatos recentes.
    2. Simule a colaboração entre seus agentes internos.
    3. Forneça uma resposta estruturada, clara e extremamente detalhada.
    4. Responda em Português do Brasil.
  `;

  const contents: any[] = [{ text: prompt }];
  if (image) {
    contents.push({
      inlineData: {
        data: image.data.split(',')[1], // Remove the data:image/png;base64, part
        mimeType: image.mimeType
      }
    });
  }

  try {
    const response = await ai.models.generateContent({
      model,
      contents: { parts: contents },
      config: {
        systemInstruction,
        tools: [{ googleSearch: {} }],
        thinkingConfig: { includeThoughts: true }
      },
    });

    return response;
  } catch (error) {
    console.error("Error calling Gemini:", error);
    throw error;
  }
}
