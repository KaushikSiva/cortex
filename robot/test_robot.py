"""Physics and independent interlock regression tests; no web server required."""
import json, time, unittest
from server import Robot
class PhysicsTests(unittest.TestCase):
 def test_walk_stop_reset_watchdog(self):
  r=Robot();x=r.state()['pose']['x']
  r.command('/navigate',{'waypoint':'PERSON','issuedAt':time.time()*1000,'speed':.55})
  for _ in range(220):r.heartbeat=time.monotonic();r.tick()
  walked=r.state()['pose']['x']-x
  self.assertGreater(walked,1.4);self.assertGreater(r.state()['height'],.6)
  r.command('/stop',{})
  for _ in range(100):r.tick()
  self.assertLess(r.state()['velocity'],.15)
  with self.assertRaises(ValueError):r.command('/navigate',{'waypoint':'HOME','issuedAt':time.time()*1000})
  r.command('/reset',{});self.assertFalse(r.estop)
  r.command('/navigate',{'waypoint':'PERSON','issuedAt':time.time()*1000});r.heartbeat=time.monotonic()-2;r.tick()
  self.assertTrue(r.estop);self.assertEqual(r.reason,'Telemetry heartbeat timeout')
  print(json.dumps({'walkedMeters':walked,'postStopSpeed':r.state()['velocity'],'policy':'official frozen G1'}))
 def test_pool_edge_clearance_uses_collision_model(self):
  r=Robot();r.sim.data.qpos[:2]=[5,4.1];self.assertLess(r.clearance(),.32)
  r.sim.data.qpos[:2]=[5,0];self.assertGreater(r.clearance(),.32)
 def test_malformed_stale_clamp(self):
  r=Robot()
  for speed in [float('nan'),float('inf'),True,-1,'fast']:
   with self.assertRaises(ValueError):r.command('/speed',{'speed':speed})
  r.command('/speed',{'speed':5});self.assertEqual(r.speed,.9)
  with self.assertRaises(ValueError):r.command('/navigate',{'waypoint':'PERSON','issuedAt':0})
  with self.assertRaises(ValueError):r.command('/navigate',{'waypoint':'UNKNOWN','issuedAt':time.time()*1000})
 def test_urgent_faster_than_calm(self):
  distances=[]
  for speed in [.55,.9]:
   r=Robot();x=r.state()['pose']['x'];r.command('/navigate',{'waypoint':'PERSON','issuedAt':time.time()*1000,'speed':speed,'approachSpeed':.5})
   for _ in range(200):r.heartbeat=time.monotonic();r.tick()
   self.assertGreater(r.state()['height'],.6);distances.append(r.state()['pose']['x']-x)
  self.assertGreater(distances[1],distances[0]*1.2);print('calm / urgent distance over 4 simulated seconds:',distances)
if __name__=='__main__':unittest.main()
