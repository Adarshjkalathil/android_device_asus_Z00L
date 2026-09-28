import pathlib
here = pathlib.Path(__file__).parent
app = (here / "app.html").read_text(encoding="utf-8")
engine = (here / "engine.js").read_text(encoding="utf-8")
assert app.count("<!--ENGINE-->") == 1
(here / "index.html").write_text(app.replace("<!--ENGINE-->", "<script>\n" + engine + "</script>"), encoding="utf-8")
print("built index.html", len(app) + len(engine), "bytes")
