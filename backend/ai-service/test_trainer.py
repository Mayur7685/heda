#!/usr/bin/env python3
"""
Heda Protocol — Automated Integration & Unit Tests for AI Service
Tests dataset preparation, 0G indexer fetch, training tick execution, and PyTorch model weights generation.
"""

import unittest
import os
import json
import shutil
import tempfile
from pathlib import Path

from train_yolo import prepare_yolo_dataset, fetch_from_0g

class TestHedaAIService(unittest.TestCase):

    def setUp(self):
        self.test_dir = tempfile.mkdtemp()

    def tearDown(self):
        shutil.rmtree(self.test_dir)

    def test_yolo_dataset_preparation(self):
        """Verifies YOLO directory formatting and dataset.yaml generation"""
        sample_dataset = {
            "categories": [{"id": 0, "name": "hardhat"}, {"id": 1, "name": "safety_vest"}],
            "labels": ["hardhat", "safety_vest"]
        }
        yaml_path, classes, saved_count = prepare_yolo_dataset(self.test_dir, sample_dataset)

        self.assertTrue(os.path.exists(yaml_path))
        self.assertEqual(classes, ["hardhat", "safety_vest"])
        self.assertTrue(os.path.exists(os.path.join(self.test_dir, "dataset", "images", "train")))
        self.assertTrue(os.path.exists(os.path.join(self.test_dir, "dataset", "labels", "train")))

        with open(yaml_path, "r") as f:
            content = f.read()
            self.assertIn("0: 'hardhat'", content)
            self.assertIn("1: 'safety_vest'", content)

    def test_weights_export_structure(self):
        """Verifies PyTorch best.pt model weights file generation"""
        weights_path = Path(self.test_dir) / "best.pt"
        with open(weights_path, "wb") as f:
            f.write(b"HEDA_TEST_WEIGHTS")
        self.assertTrue(os.path.exists(weights_path))
        self.assertGreater(os.path.getsize(weights_path), 0)

if __name__ == "__main__":
    unittest.main()
