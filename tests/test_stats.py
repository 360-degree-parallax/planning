import os, sys, unittest
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'tools'))
import stats


class T(unittest.TestCase):
    def test_sample_size_known(self):
        # p=10% → 11% (상대 +10%), 5%/80%: 교과서 값 약 14,750
        n = stats.sample_size(0.10, {'value': 10, 'unit': 'relative'})
        self.assertTrue(14600 < n < 14900, n)

    def test_sample_size_pp(self):
        self.assertEqual(stats.sample_size(0.5, {'value': 5, 'unit': 'pp'}),
                         stats.sample_size(0.5, {'value': 10, 'unit': 'relative'}))

    def test_sample_size_invalid(self):
        self.assertIsNone(stats.sample_size(0.95, {'value': 10, 'unit': 'relative'}))
        self.assertIsNone(stats.sample_size(0.3, {'value': 0, 'unit': 'relative'}))

    def test_ztest_symmetric(self):
        p1, p2, lift, p = stats.ztest({'n': 1000, 'conv': 100}, {'n': 1000, 'conv': 100})
        self.assertAlmostEqual(p, 1.0)
        self.assertEqual(lift, 0)

    def test_ztest_significant(self):
        *_, p = stats.ztest({'n': 10000, 'conv': 1000}, {'n': 10000, 'conv': 1150})
        self.assertLess(p, 0.001)

    def test_welch(self):
        a = {'n': 1000, 'revenue_sum': 40000 * 50, 'revenue_sumsq': 40000 ** 2 * 50}
        b = {'n': 1000, 'revenue_sum': 40000 * 80, 'revenue_sumsq': 40000 ** 2 * 80}
        m1, m2, lift, p = stats.welch(a, b)
        self.assertAlmostEqual(m1, 2000)
        self.assertAlmostEqual(lift, 0.6)
        self.assertLess(p, 0.05)

    def test_srm(self):
        self.assertGreater(stats.srm([5000, 5000]), 0.9)
        self.assertLess(stats.srm([5000, 5400]), 0.001)
        self.assertGreater(stats.srm([3333, 3333, 3334]), 0.9)

    def test_bonferroni(self):
        self.assertAlmostEqual(stats.bonferroni(0.05, 3), 0.025)

    def test_pearson(self):
        self.assertAlmostEqual(stats.pearson([1, 2, 3, 4], [2, 4, 6, 8]), 1.0)
        self.assertIsNone(stats.pearson([1, 2], [1, 2]))


if __name__ == '__main__':
    unittest.main()
