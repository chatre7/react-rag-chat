import io

import pytest

from app import parsers


def test_extract_text_from_txt():
    data = 'JamAI elevates RAG.'.encode('utf-8')
    result = parsers.extract_text('note.txt', data)
    assert result == 'JamAI elevates RAG.'


def test_extract_text_from_csv():
    csv_bytes = b'name,role\nAlex,Engineer\nBoon,Designer\n'
    result = parsers.extract_text('people.csv', csv_bytes)
    assert 'Alex\tEngineer' in result
    assert 'Boon\tDesigner' in result


def test_extract_text_unsupported():
    with pytest.raises(parsers.UnsupportedFileTypeError):
        parsers.extract_text('diagram.svg', b'<svg></svg>')
