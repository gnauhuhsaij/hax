from transformers import AutoTokenizer, AutoModelForSeq2SeqLM

tokenizer = AutoTokenizer.from_pretrained("facebook/bart-large-cnn")
summarizer = AutoModelForSeq2SeqLM.from_pretrained("facebook/bart-large-cnn")

def summarize_text(text):
    inputs = tokenizer([text], max_length=1024, truncation=True, return_tensors="pt")
    summary_ids = summarizer.generate(
        inputs["input_ids"],
        num_beams=4,        # beam search for better results
        min_length=30,      # min summary length
        max_length=100,     # max summary length
        length_penalty=2.0, # penalize long outputs
        early_stopping=True
    )
    # Step 3: Decode
    summary = tokenizer.decode(summary_ids[0], skip_special_tokens=True)    
    return summary