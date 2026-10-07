import urllib.request, urllib.error,json
URL='https://reccddfusealreknvjfj.supabase.co/functions/v1/nexus'
KEY='REPLACE_WITH_YOUR_API_KEY'
def call(op,secret=None,**kw):
 req=urllib.request.Request(URL,data=json.dumps(dict(op=op,secret=secret,**kw)).encode(),headers={'Content-Type':'application/json','apikey':KEY})
 try:
  with urllib.request.urlopen(req,timeout=40) as r:return json.load(r)
 except urllib.error.HTTPError as e:raise RuntimeError(e.read().decode())
def rejects(op,secret=None,**kw):
 try:call(op,secret,**kw)
 except RuntimeError:return
 raise AssertionError('Expected rejection '+op)
a,b,c=[call('register') for _ in range(3)]
sa,sb,sc=[x['secret'] for x in [a,b,c]]
assert len(call('inventory',sa)['cards'])==3
rejects('inventory','0'*64)
r=call('room-create',sa,game='memory');code=r['code']
r=call('room-join',sb,code=code);assert len(r['players'])==2
rejects('room-state',sc,code=code)
rejects('room-start',sb,code=code)
r=call('room-start',sa,code=code);assert all(x is None for x in r['board'])
rejects('room-move',sb,code=code,revision=r['revision'],move={'index':0})
r=call('room-move',sa,code=code,revision=r['revision'],move={'index':0});assert r['board'][0] is not None
reconnect=call('room-state',sa,code=code);assert reconnect['revision']==r['revision']
rejects('room-move',sa,code=code,revision=r['revision']-1,move={'index':1})
for game in ['odin','tapple','shadow','trivia','pattern','scramble','spot']:
 r=call('room-create',sa,game=game);code=r['code'];call('room-join',sb,code=code)
 if game=='shadow':call('room-join',sc,code=code)
 r=call('room-start',sa,code=code)
 if game=='odin':assert len(r['hand'])==7 and 'hands' not in r and 'deck' not in r
 if game=='shadow':assert 'spy' not in r and 'word' not in r
 if game=='trivia':assert len(r['question'])==2
 if game in ['pattern','scramble']:assert 'answer' not in r
print('Live: all 8 game rooms start, cross-device joins, privacy, turns, reconnect, stale moves passed')
t=call('trade-create',sa);code=t['code'];t=call('trade-join',sb,code=code)
ac=call('inventory',sa)['cards'];bc=call('inventory',sb)['cards']
t=call('trade-offer',sa,code=code,revision=t['revision'],cards=[ac[0]['id']])
t=call('trade-offer',sb,code=code,revision=t['revision'],cards=[bc[0]['id']])
assert t['fairness']=='balanced'
t=call('trade-confirm',sa,code=code,revision=t['revision'])
assert t['confirmed_a']==t['revision']
t=call('trade-offer',sb,code=code,revision=t['revision'],cards=[bc[1]['id']]);assert t['confirmed_a'] is None
rejects('trade-offer',sa,code=code,revision=t['revision'],cards=[bc[0]['id']])
t=call('trade-confirm',sa,code=code,revision=t['revision']);t=call('trade-confirm',sb,code=code,revision=t['revision']);assert t['status']=='completed'
assert bc[1]['id'] in [x['id'] for x in call('inventory',sa)['cards']]
assert ac[0]['id'] in [x['id'] for x in call('inventory',sb)['cards']]
rejects('trade-confirm',sa,code=code,revision=t['revision'])
print('Live: exact-offer confirmations, reset after changes, ownership checks, atomic exchange, repeat rejection passed')
print('Test player IDs:',','.join(x['player']['id'] for x in [a,b,c]))
