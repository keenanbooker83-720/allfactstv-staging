import importlib.util
import tempfile
import unittest
from pathlib import Path

SPEC=importlib.util.spec_from_file_location('control',Path(__file__).resolve().parents[1]/'control.py')
control=importlib.util.module_from_spec(SPEC);SPEC.loader.exec_module(control)

def sample(**changes):
    product=dict(id='example-film', title='Example Film', type='paid', category='Science',
                 previewUrl='https://media.example.org/preview.mp4',checkoutReady=False,independentPlaybackReady=False)
    product.update(changes)
    return {'schemaVersion':1,'products':[product]}

class EmergencyControlTests(unittest.TestCase):
    def test_empty_catalog_is_valid(self): self.assertEqual(control.validate({'schemaVersion':1,'products':[]}),[])
    def test_paid_not_ready_default(self): self.assertEqual(control.validate(sample()),[])
    def test_guard_rejects_unverified_link(self):
        self.assertTrue(control.validate(sample(checkoutReady=True)))
    def test_rejects_private_master_key(self):
        self.assertTrue(control.validate(sample(masterUrl='https://private.example.org/master.mp4')))
    def test_rejects_checkout_host_impersonator(self):
        self.assertFalse(control.checkout('https://buy.stripe.com.evil.tld/abc'))
    def test_valid_ready_requires_verified(self):
        self.assertEqual(control.validate(sample(checkoutReady=True,independentPlaybackReady=True,purchaseUrl='https://buy.stripe.com/test123',verifiedAt='2026-11-09')),[])
    def test_duplicate_rejected(self):
        obj=sample();obj['products'].append(obj['products'][0].copy());self.assertTrue(control.validate(obj))
    def test_atomic_save_reload(self):
        with tempfile.TemporaryDirectory() as tmp:
            p=Path(tmp)/'cat.json';control.save(sample(),p)
            self.assertEqual(control.load(p)['products'][0]['id'],'example-film')

if __name__=='__main__': unittest.main()