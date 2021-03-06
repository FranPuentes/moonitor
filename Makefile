
pull:
	git pull
	(cd deps/daemon.node-master && node-waf clean && node-waf configure build)
	mkdir -p sessions
	mkdir -p cache

clean:
	find . -name \*~ -delete
	rm -f *.log
	rm -f *.pid

tgz:
	tar czvf moon-broker.tgz broker moon-broker.js common modules web deps sessions cache
	tar czvf moon-daemon.tgz daemon moon-daemon.js common plugins     deps/daemon.node-master

commit:
	git commit -a

push: clean tgz commit
	git push https://github.com/FranPuentes/moonitor.git
