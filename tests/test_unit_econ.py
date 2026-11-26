import json, os, sys, unittest
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'tools'))
import unit_econ as u

ROOT = os.path.join(os.path.dirname(__file__), '..')


class T(unittest.TestCase):
    def setUp(self):
        self.cfg = json.load(open(os.path.join(ROOT, 'db/service/unit-econ.example.json'), encoding='utf-8'))

    def test_model_cost(self):
        m = {'input_tokens': 1_000_000, 'input_price_per_m': 1.0, 'output_tokens': 0, 'output_price_per_m': 0}
        self.assertAlmostEqual(u.model_cost(m, 1000), 1000)

    def test_break_even_zero_margin(self):
        be = u.break_even_price(self.cfg)
        pack = {'id': 'x', 'questions': 1, 'price': be}
        self.assertLess(abs(u.per_question(pack, self.cfg)['contribution']), 3)

    def test_bigger_pack_lower_margin(self):
        r = [u.per_question(p, self.cfg)['cm_rate'] for p in self.cfg['packs']]
        self.assertGreaterEqual(r[0], r[-1])

    def test_channel_share(self):
        bad = [{'share': 0.5, 'fee_rate': 0.03}]
        with self.assertRaises(ValueError):
            u.blended_fee(bad)


if __name__ == '__main__':
    unittest.main()
