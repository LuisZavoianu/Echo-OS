import { pipeline, env } from '@xenova/transformers';

// Configurare pentru a permite descărcarea modelelor de pe Hugging Face
env.allowLocalModels = false;

let classifier: any = null;

export const analyzeTextLocally = async (text: string) => {
  if (!classifier) {
    console.log("Se descarcă modelul AI (aprox. 30MB)...");
    classifier = await pipeline('sentiment-analysis', 'Xenova/distilbert-base-uncased-finetuned-sst-2-english');
    console.log("Model încărcat cu succes!");
  }
  
  const results = await classifier(text);
  return results[0]; 
};