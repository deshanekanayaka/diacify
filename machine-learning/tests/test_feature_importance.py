from unittest.mock import Mock

from feature_importance import rank_feature_importance


def test_rank_feature_importance_pairs_names_with_scores_sorted_descending():
    model = Mock(feature_importances_=[0.1, 0.5, 0.2])
    ranked = rank_feature_importance(model, feature_names=("a", "b", "c"))
    assert ranked == [("b", 0.5), ("c", 0.2), ("a", 0.1)]


def test_rank_feature_importance_defaults_to_feature_names():
    from feature_matrix import FEATURE_NAMES

    model = Mock(feature_importances_=[float(i) for i in range(len(FEATURE_NAMES))])
    ranked = rank_feature_importance(model)
    assert len(ranked) == len(FEATURE_NAMES)
    assert {name for name, _ in ranked} == set(FEATURE_NAMES)
