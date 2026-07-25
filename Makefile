.PHONY: all check test render build serve links help

help:
	@echo "make check    verify index.html, app.js and resources_db.js still agree (run before committing)"
	@echo "make test     run the unit tests (scheduler, store, server)"
	@echo "make render   regenerate index.html panels from data/panels/*.json"
	@echo "make build    regenerate resources_db.js + app.js registries from data/resources/*.json"
	@echo "make all      render, build, then check"
	@echo "make serve    serve on http://localhost:8000 (also hosts the /api routes)"
	@echo "make links    sweep every URL for liveness (slow, network)"

check:
	@node tools/check.js

test:
	@node --test test/*.test.js

render:
	@python3 tools/render.py

build:
	@node tools/build.js

all: render build check

serve:
	@node server/index.js

links:
	@bash tools/link_check.sh
