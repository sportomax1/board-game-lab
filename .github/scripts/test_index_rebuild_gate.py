"""Policy regression tests for the smart index gate."""
import sys
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory
from os import chdir, getcwd

sys.path.insert(0, str(Path(__file__).parent))
from index_rebuild_gate import IndexedLinks, decide, eligible, current_catalog

class TestIndexGate(unittest.TestCase):
    def test_new_file_immediate(self):
        self.assertTrue(decide({"new.html"}, set(), set(), True)[0])
    def test_old_missing_file_immediate(self):
        self.assertTrue(decide({"old.html"}, set(), {"old.html"}, True)[0])
    def test_first_daily_app_edit(self):
        self.assertTrue(decide({"old.html"}, {"old.html"}, {"old.html"}, False)[0])
    def test_repeated_same_day_edit(self):
        self.assertFalse(decide({"old.html"}, {"old.html"}, {"old.html"}, True)[0])
    def test_no_change(self):
        self.assertFalse(decide({"old.html"}, {"old.html"}, set(), False)[0])
    def test_deleted_file(self):
        self.assertTrue(decide(set(), {"old.html"}, set(), True)[0])
    def test_manual(self):
        self.assertTrue(decide(set(), set(), set(), True, manual=True)[0])
    def test_only_app_cards_count(self):
        parser = IndexedLinks()
        parser.feed('<a href="app.html" class="app-card">x</a>'
                    '<a class="app-card" href="folder/old.html">y</a>'
                    '<a href="other.html">z</a>')
        self.assertEqual(parser.paths, {"app.html", "folder/old.html"})
    def test_excluded(self):
        self.assertFalse(eligible(".github/workflows/workflow.yml"))
        self.assertFalse(eligible("api/foo.js"))
        self.assertFalse(eligible("index.html"))
        self.assertTrue(eligible("games/another.html"))
    def test_disk_scan(self):
        previous = getcwd()
        with TemporaryDirectory() as folder:
            try:
                chdir(folder)
                Path("games").mkdir()
                Path("api").mkdir()
                Path("games/app.html").write_text("app")
                Path("api/endpoint.js").write_text("secret")
                Path("index.html").write_text("index")
                self.assertEqual(current_catalog(), {"games/app.html"})
            finally:
                chdir(previous)

if __name__ == "__main__":
    unittest.main()
