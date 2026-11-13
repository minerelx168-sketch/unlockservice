import runpy,ipaddress,datetime as dt,tempfile,json,gzip,unittest
from pathlib import Path
m=runpy.run_path("scripts/audit-openai-access.py"); bot="OAI-SearchBot"; other="ChatGPT-User"
nets={bot:[ipaddress.ip_network("192.0.2.0/24")],other:[ipaddress.ip_network("2001:db8::/32")]}
day=dt.date(2026,11,13)
def row(ip="192.0.2.4",b=bot,path="/articles/guide?q=SECRET",method="GET",host="iunlockmobile.com",timestamp="2026-11-12T17:00:00+00:00"):
 return {"ts":dt.datetime.fromisoformat(timestamp).timestamp(),"status":200,"request":{"host":host,"method":method,"uri":path,"remote_ip":ip,"headers":{"User-Agent":[b+"/1.0"],"X-Forwarded-For":["192.0.2.1"]}}}
def scan(*rows):
 with tempfile.TemporaryDirectory() as d:
  p=Path(d)/"log.gz"
  with gzip.open(p,"wt") as f:
   for r in rows:f.write((json.dumps(r) if r is not None else "!")+"\n")
  return m["scan"]([p,p],day,nets)
class Test(unittest.TestCase):
 def test_success(self):
  s=scan(row(),row("2001:db8::3",other,method="HEAD")); self.assertEqual((s["matching_requests"],[v["peer"] for v in s["counts"]]),(2,["official_range_peer"]*2));self.assertNotIn("SECRET",str(s))
 def test_spoof(self):self.assertEqual(scan(row("203.0.113.2"))["counts"][0]["peer"],"unverified_peer")
 def test_wrong_bot_range(self):self.assertEqual(scan(row(b=other))["counts"][0]["peer"],"unverified_peer")
 def test_private(self):self.assertEqual(scan(row(path="/api/checkout"),row(path="/services/unlock/more"),row(method="POST"),row(path="/admin"))["matching_requests"],0)
 def test_coverage(self):self.assertIsNone(scan(row(host="staging.invalid"),row(timestamp="2026-11-13T17:00:00+00:00"))["matching_requests"])
 def test_damage(self):self.assertEqual(scan(None)["malformed_records"],1)
 def test_http(self):
  r=row();r["status"]=403;self.assertEqual(scan(r)["counts"][0]["http"],403)
unittest.main()
