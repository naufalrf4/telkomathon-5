import tiktoken

_tokenizer: tiktoken.Encoding | None = None


def _get_tokenizer() -> tiktoken.Encoding:
    global _tokenizer
    if _tokenizer is None:
        _tokenizer = tiktoken.get_encoding("cl100k_base")
    return _tokenizer


def chunk_text(
    text: str,
    chunk_size: int = 500,
    overlap: int = 100,
) -> list[dict[str, object]]:
    tokenizer = _get_tokenizer()
    tokens = tokenizer.encode(text)
    chunks: list[dict[str, object]] = []

    if not tokens:
        return chunks

    step = chunk_size - overlap
    for chunk_index, start in enumerate(range(0, len(tokens), step)):
        chunk_tokens = tokens[start : start + chunk_size]
        if not chunk_tokens:
            break

        chunk_text_str = tokenizer.decode(chunk_tokens)
        heading = _extract_heading(chunk_text_str)
        section = _extract_section(chunk_text_str)

        chunks.append(
            {
                "text": chunk_text_str,
                "metadata": {
                    "chunk_index": chunk_index,
                    "heading": heading,
                    "section": section,
                    "page_number": None,
                },
            }
        )
        if start + chunk_size >= len(tokens):
            break

    return chunks


def _extract_heading(text: str) -> str:
    lines = text.strip().split("\n")
    for line in lines[:3]:
        stripped = line.strip()
        if stripped and len(stripped) < 100:
            return stripped
    return ""


def _extract_section(text: str) -> str:
    for line in text.split("\n"):
        stripped = line.strip()
        if stripped.isupper() and len(stripped) > 3 and len(stripped) < 80:
            return stripped
    return "Content"
