#!/usr/bin/env python3
"""Regenerate index.html's body panels from data/panels/*.json.

The panel JSON is the source of truth for curriculum content. The <head>,
inline <style>, site header and trailing <script> tags in index.html are
preserved verbatim.

Validates BEFORE writing:
  - every week label sits inside its phase's stated range
  - week starts never go backwards across the plan (overlap is allowed;
    a start preceding an earlier start is not)
  - no duplicate task ids
Validates AFTER rendering:
  - every id/attribute app.js binds to is still present

Exits non-zero and writes nothing if any check fails.

Usage: python3 tools/render.py
"""
import json, re, sys, html, glob, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HTML = os.path.join(ROOT, 'index.html')
PANELS = os.path.join(ROOT, 'data', 'panels')

phases, overview = [], None
for f in sorted(glob.glob(os.path.join(PANELS, 'panel_p*.json'))):
    data = json.load(open(f))
    if isinstance(data, dict):
        phases.extend(data.get('phases', []))
        if data.get('overview'):
            overview = data['overview']
    else:
        phases.extend(data)
phases.sort(key=lambda p: p['id'])
if overview is None:
    sys.exit('FATAL: no overview object found in data/panels/')

errors = []
# authors mix raw "&" and "&amp;"; normalise so neither double-escapes
E = lambda s: html.escape(html.unescape(s), quote=False)
short = lambda pid: 'p' + pid[-1]


def weeks_of(label):
    n = [int(x) for x in re.findall(r'\d+', label)]
    return (n[0], n[-1]) if n else None


prev = 0
for ph in phases:
    rng = weeks_of(ph['weeks'])
    for t in ph['tasks']:
        for it in t['items']:
            b = weeks_of(it.get('time', ''))
            if not b:
                continue
            if b[0] < rng[0] or b[1] > rng[1]:
                errors.append('%s / %s: "%s" outside %s' % (t['id'], it['title'], it['time'], ph['weeks']))
            if b[0] < prev:
                errors.append('%s / %s: "%s" starts before an earlier item (week %d)' % (
                    t['id'], it['title'], it['time'], prev))
            prev = max(prev, b[0])

ids = [t['id'] for ph in phases for t in ph['tasks']] + [ph['milestone']['id'] for ph in phases]
dupes = sorted({i for i in ids if ids.count(i) > 1})
if dupes:
    errors.append('duplicate task ids: %s' % dupes)

if errors:
    print('VALIDATION FAILED — index.html not written:')
    for e in errors:
        print('  ' + e)
    sys.exit(1)


def callouts(cs, style=''):
    return ''.join('\n      <div class="callout callout-%s"%s>\n        %s\n      </div>' % (c['type'], style, c['html'])
                   for c in (cs or []))


def task_html(t):
    items = ''
    for it in t['items']:
        res = ''
        if it.get('resource'):
            res = '\n          <a class="resource" href="%s" target="_blank">%s</a>' % (
                it['resource']['url'], E(it['resource']['label']))
        items += '''
        <div class="task-item">
          <div class="task-item-title">%s</div>
          <div class="task-item-desc">%s</div>
          <div class="task-item-time">%s</div>%s
        </div>''' % (E(it['title']), E(it['desc']), E(it.get('time', '')), res)
    return '''
    <div class="day-section" id="sec-%s">
      <div class="day-header">
        <span class="day-num-badge">%s</span>
        <span class="day-title-text">%s</span>
        <span class="tag tag-%s">%s</span>
        <label class="day-check">
          <input type="checkbox" data-id="%s">
          <span>Done</span>
        </label>
      </div>
      <div class="task-grid">%s
      </div>%s
    </div>
''' % (t['id'], E(t['badge']), t['title'], t['tag'], t['tag'].capitalize(), t['id'], items,
       callouts(t.get('callouts')))


def milestone_html(ph):
    m = ph['milestone']
    lis = ''.join('\n          <li>%s</li>' % li for li in m['items'])
    nxt = ''
    if m.get('next'):
        nxt = '''
        <div style="margin-top:1rem; padding-top:1rem; border-top:1px solid var(--border); font-size:12px; color:var(--muted2)">
          Next: <a href="%s" style="color:var(--blue)">%s</a>
        </div>''' % (m['next']['href'], m['next']['label'])
    return '''
    <div class="day-section" id="sec-%s">
      <div class="day-header">
        <span class="day-num-badge">%s</span>
        <span class="day-title-text">%s</span>
        <span class="tag tag-exercise">Deliverable</span>
        <label class="day-check">
          <input type="checkbox" data-id="%s">
          <span>Done</span>
        </label>
      </div>
      <div class="milestone-box">
        <h3>%s</h3>
        <ul class="checklist">%s
        </ul>%s
      </div>
    </div>
''' % (m['id'], E(m['badge']), E(m['title']), m['id'], E(m['heading']), lis, nxt)


def phase_panel(ph):
    s = short(ph['id'])
    return '''
<!-- %s PANEL -->
<div id="view-%s" class="view-panel">
  <div class="container-sm">
    <div class="breadcrumb">
      <a href="#overview">Overview</a>
      <span>›</span>
      <span>%s</span>
    </div>

    <div class="page-hero">
      <div class="page-hero-eyebrow">Phase %s · %s</div>
      <h1>%s</h1>
      <p>%s</p>
    </div>

    <div class="progress-header">
      <div style="flex: 1;">
        <progress-bar id="progress-bar-%s" value="0"></progress-bar>
      </div>
      <span class="progress-label" id="progress-label-%s">0%% complete</span>
    </div>
%s%s%s  </div>
</div>
''' % (ph['id'].upper(), ph['id'], E(ph['title'].replace('<br>', ' ')), ph['num'], ph['weeks'],
       ph['title'], E(ph['intro']), s, s,
       ''.join('\n    <div class="callout callout-%s" style="margin-bottom:2rem">\n      %s\n    </div>\n' % (c['type'], c['html'])
               for c in (ph.get('callouts') or [])),
       ''.join(task_html(t) for t in ph['tasks']),
       milestone_html(ph))


o = overview
cards = ''
for c in o['cards']:
    s = 'p' + c['num'][-1]
    tags = ''.join('\n            <span class="tag tag-%s">%s</span>' % (t.lower(), t) for t in c['tags'])
    cards += '''
      <a href="%s" class="phase-card">
        <div class="phase-card-inner">
          <div class="phase-num">%s</div>
          <div class="phase-title">%s</div>
          <div class="phase-weeks">%s</div>
          <div class="phase-tag-row">%s
          </div>
          <div class="phase-count">
            <span data-phase-count="%s">0</span>
          </div>
          <div class="phase-progress-bar" style="border:none; padding-top:0.5rem;">
            <progress-bar data-phase-fill="%s" value="0"></progress-bar>
          </div>
        </div>
      </a>
''' % (c['href'], c['num'], c['title'], c['weeks'], tags, s, s)

notes = ''.join('\n    <div class="note-box">\n      %s\n    </div>\n' % o[k]
                for k in ('honesty', 'budget') if o.get(k))

overview_panel = '''
<!-- OVERVIEW VIEW PANEL -->
<div id="view-overview" class="view-panel">
  <div class="container">
    <div class="hero">
      <div class="hero-eyebrow">%s</div>
      <h1>%s<br><span>%s</span></h1>
      <p>%s</p>
      <div class="global-bar">
        <div style="flex: 1; max-width: 320px;">
          <progress-bar id="global-bar-fill" value="0"></progress-bar>
        </div>
        <span class="global-bar-label"><span id="global-done">0</span> / <span id="global-total">0</span> tasks · <span id="global-pct">0</span>%%</span>
      </div>
    </div>
%s
    <div class="section-label" style="margin-top:3rem">Progress by phase</div>

    <div class="stats-row" style="margin-bottom:1px">
      <div class="stat">
        <div class="stat-num" id="global-done-2">0</div>
        <div class="stat-label">Tasks done</div>
      </div>
      <div class="stat">
        <div class="stat-num" id="global-pct-2">0%%</div>
        <div class="stat-label">Overall progress</div>
      </div>
      <div class="stat">
        <div class="stat-num" id="phases-started">0</div>
        <div class="stat-label">Phases started</div>
      </div>
      <div class="stat">
        <div class="stat-num" id="streak-weeks">52</div>
        <div class="stat-label">Week runway</div>
      </div>
    </div>

    <div class="phase-grid" style="margin-top:1px; margin-bottom:3rem">%s    </div>
  </div>
</div>
''' % (E(o['eyebrow']), E(o['h1_line1']), E(o['h1_accent']), E(o['intro']), notes, cards)

src = open(HTML).read()
head = src[:src.index('<!-- OVERVIEW VIEW PANEL -->')]
tail = src[src.index('<script src="resources_db.js">'):]
new = head + (overview_panel + ''.join(phase_panel(p) for p in phases)).lstrip('\n') + '\n' + tail

need = ['id="global-bar-fill"', 'id="global-done"', 'id="global-total"', 'id="global-pct"',
        'id="global-done-2"', 'id="global-pct-2"', 'id="phases-started"', 'id="streak-weeks"']
for s in ['p0', 'p1', 'p2', 'p3', 'p4']:
    need += ['id="progress-bar-%s"' % s, 'id="progress-label-%s"' % s,
             'data-phase-count="%s"' % s, 'data-phase-fill="%s"' % s]
missing = [n for n in need if n not in new]
if missing:
    sys.exit('FATAL: app.js hooks missing after render: %s' % missing)

open(HTML, 'w').write(new)
ntask = sum(len(p['tasks']) for p in phases)
nitem = sum(len(t['items']) for p in phases for t in p['tasks'])
print('rendered %d phases, %d tasks (+%d milestones), %d subtasks'
      % (len(phases), ntask, len(phases), nitem))
