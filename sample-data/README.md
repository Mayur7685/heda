# Heda Sample Data

Ready-to-use test files for each annotation and fine-tuning flow.

---

## text-sentiment/ — Sentiment Classification
**10 product review files**

- **Job type:** Text
- **Schema:** Chat Messages (recommended)
- **Labels:** `positive, negative, neutral`
- **Annotator task:** Read each review, click the correct sentiment label
- **Output JSONL:**
  ```jsonl
  {"messages": [{"role": "user", "content": "The product quality exceeded..."}, {"role": "assistant", "content": "positive"}]}
  ```
- **Fine-tune use:** Train Qwen to classify product reviews

---

## text-instruction/ — Q&A / Instruction Following
**8 question files**

- **Job type:** Text
- **Schema:** Instruction format
- **Labels:** `answered, needs-clarification, out-of-scope`
- **Annotator task:** Label whether each question can be answered directly
- **Output JSONL:**
  ```jsonl
  {"instruction": "Answer the question", "input": "What is the capital of France?", "output": "answered"}
  ```
- **Fine-tune use:** Train model to handle Q&A routing

---

## text-completion/ — Story Completion
**5 story prompt files**

- **Job type:** Text
- **Schema:** Text Completion
- **Labels:** `sci-fi, fantasy, realistic, mystery`
- **Annotator task:** Label the genre of each story prompt
- **Output JSONL:**
  ```jsonl
  {"text": "Once upon a time...\nfantasy"}
  ```
- **Fine-tune use:** Genre classification for creative writing

---

## How to use

1. Go to **Create Job** in Heda
2. Select **Text** data type
3. Choose the matching **JSONL Schema**
4. Upload the `.txt` files from the folder
5. Set labels as shown above
6. Set reward: `0.001 0G` per task
7. Post the job

After annotating and approving all tasks, publish the dataset and fine-tune on 0G Compute.
