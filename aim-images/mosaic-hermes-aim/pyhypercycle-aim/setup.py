#!/usr/bin/env python3
from setuptools import setup, find_packages

__VERSION__ = "1.0.0"

def main(args=None):
    README = open("./README.md").read()

    setup_required_packages = []

    required_packages = ["starlette", "uvicorn[standard]", "filelock", "web3", "websocket-client"
                        ]

    test_required_packages = ["nose", "coverage"]

    settings = dict(name="pyhypercycle_aim",
                    version=__VERSION__,
                    description="Hypercycle AIM Library",
                    long_description=README,
                    classifiers=["Programming Language :: Python", ],
                    author="",
                    author_email="",
                    url="",
                    keywords="hypercycle aim library",
                    packages=find_packages(),
                    include_package_data=True,
                    zip_safe=False,
                    install_requires=required_packages,
                    tests_require=test_required_packages,
                    test_suite="nose.collector",
                    setup_requires=setup_required_packages
                    )
    if args:
        settings['script_name'] = __file__
        settings['script_args'] = args
    setup(**settings)


if __name__ == "__main__":
    main()

